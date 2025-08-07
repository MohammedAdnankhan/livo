const {
  LANGUAGES,
  MAINTENANCE_TYPES,
  MAINTENANCE_STATUSES,
  DEPARTMENT_TYPES,
  DESIGNATION_TYPES,
  APPOINTMENT_TYPES,
  TIMEZONES,
  STAFF_AVAILABILITY_STATUS,
  MAINTENANCE_REQUESTED_BY,
  SOURCE_TYPES,
  ACTION_TYPES,
  ENVIRONMENTS,
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
} = require("../../config/constants");
const {
  getStaff,
  getStaffSlotsWithTime,
  updateStaffTimeSlots,
} = require("../../staff-service/controllers/staff");
const { getUser } = require("../../user-service/controllers/user");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const { getDateTimeObjectFromTimezone } = require("../../utils/utility");
const moment = require("moment-timezone");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const {
  getRequestWithFlatBuildingAndStaff,
  getMaintenanceRequest,
} = require("./maintenanceRequest");
const MaintenanceStatus = require("../models/MaintenanceStatus");
const User = require("../../user-service/models/User");
const StaffTimeslot = require("../../staff-service/models/StaffTimeslot");
const db = require("../../database");
const { requestAssignment } = require("../../utils/templates/messageTemplates");
const eventEmitter = require("../../utils/eventEmitter");
const { sendSMS } = require("../../utils/sms");
const env = process.env.NODE_ENV || "development";
const { getCategoryFromFlat, getCategory } = require("./maintenanceCategory");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const {
  getFlatWithBuilding,
  getFlat,
} = require("../../flat-service/controllers/flat");
const {
  requestCompletedForUser,
  requestCompletedForAdmin,
  requestStatusChangeForAdmin,
  requestStatusChangeForUser,
  requestCreatedForUser,
  requestCreatedForAdmin,
} = require("../../utils/email");
const { getBuilding } = require("../../building-service/controllers/building");
const MaintenanceProduct = require("../models/MaintenanceProduct");
const Inventory = require("../../inventory-service/models/Inventory");
const { Op } = require("sequelize");

//assign staff to a maintenance request
const assignStaff = async (data, timezone = TIMEZONES.INDIA, admin) => {
  //check if requestId and staffId is coming
  if (!data.requestId || !data.staffId) {
    throw new AppError(
      "assignStaff",
      "Request ID and Staff ID are required",
      "custom",
      412
    );
  }

  //check for staffs time slots coming in payload
  if (
    !data.staffTimeSlots ||
    !Array.isArray(data.staffTimeSlots) ||
    !data.staffTimeSlots.length
  ) {
    throw new AppError(
      "assignStaff",
      "Staff time slot is required",
      "custom",
      412
    );
  }

  //find request
  let maintenanceRequest = await MaintenanceRequest.findOne({
    where: { id: data.requestId },
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });
  if (!maintenanceRequest) {
    throw new AppError("assignStaff", "Request not found", "custom", 404);
  }

  if (
    !new Array(
      MAINTENANCE_STATUSES.PENDING.key,
      MAINTENANCE_STATUSES.RE_OPEN.key,
      MAINTENANCE_STATUSES.PROCESSING.key,
      MAINTENANCE_STATUSES.QUOTATION_APPROVED.key
    ).includes(maintenanceRequest.statusDetails[0].status)
  ) {
    throw new AppError(
      "assignStaff",
      `Cannot assign staff at ${maintenanceRequest.statusDetails[0].status} stage`,
      "custom",
      412
    );
  }

  //find staff
  const staff = await getStaff({ id: data.staffId }, undefined, [
    "id",
    "name",
    "email",
    "mobileNumber",
    "profilePicture",
  ]);
  if (!staff) {
    throw new AppError("assignStaff", "Staff not found", "custom", 404);
  }

  //check for staff availability from payload's time slots
  const staffCalender = await getStaffSlotsWithTime({
    id: data.staffTimeSlots,
    staffId: staff.id,
  });

  if (!staffCalender.length) {
    throw new AppError(
      "assignStaff",
      "Staff schedule not found",
      "custom",
      404
    );
  }

  let ids = [],
    requestStatus;

  staffCalender.map((calender) => {
    const timeCheck =
      moment().tz(timezone) > moment(calender.timeSlot.startTime).tz(timezone);
    if (timeCheck) {
      throw new AppError(
        "assignStaff",
        "Selected time has passed",
        "custom",
        412
      );
    }
    if (calender.status != STAFF_AVAILABILITY_STATUS.AVAILABLE) {
      throw new AppError(
        "assignStaff",
        "Staff not available for given time slot",
        "custom",
        412
      );
    }
    ids.push(calender.id);
  });

  if (maintenanceRequest.staffId !== null) {
    requestStatus = MAINTENANCE_STATUSES.RE_ASSIGNED.key;
  } else {
    requestStatus = MAINTENANCE_STATUSES.ASSIGNED.key;
  }

  const transaction = await db.sequelize.transaction();
  try {
    //mark prev staff's time slots as available if mentioned time hasn't passed
    if (
      maintenanceRequest.staffId &&
      moment().tz(timezone) <
        moment(maintenanceRequest.staffTimeSlot.start).tz(timezone)
    ) {
      await StaffTimeslot.update(
        { status: STAFF_AVAILABILITY_STATUS.AVAILABLE },
        {
          where: { id: maintenanceRequest.staffTimeSlot.staffTimeSlotIds },
          transaction,
        }
      );
    }

    //mark new staff's time slots as booked
    await StaffTimeslot.update(
      { status: STAFF_AVAILABILITY_STATUS.BOOKED },
      { where: { id: ids }, transaction }
    );

    //update request with staffId
    await MaintenanceRequest.update(
      {
        status: requestStatus,
        staffId: staff.id,
        staffTimeSlot: {
          start: staffCalender[0].timeSlot.startTime,
          end: staffCalender[staffCalender.length - 1].timeSlot.endTime,
          staffTimeSlotIds: ids,
        },
      },
      { where: { id: maintenanceRequest.id }, transaction }
    );

    //create entry in status table
    await MaintenanceStatus.create(
      {
        status: requestStatus,
        comment: data?.comment,
        maintenanceId: maintenanceRequest.id,
        files: data?.files,
        metaData: {
          staffId: staff.id,
          staffName: staff.name,
          mobileNumber: staff.mobileNumber,
          profilePicture: staff.profilePicture,
          timeSlot: {
            start: staffCalender[0].timeSlot.startTime,
            end: staffCalender[staffCalender.length - 1].timeSlot.endTime,
          },
        },
      },
      transaction
    );

    await transaction.commit();

    if (maintenanceRequest.staffId !== null) {
      eventEmitter.emit("admin_level_notification", {
        flatId: maintenanceRequest.flatId,
        actionType: ADMIN_ACTION_TYPES.SERVICE_REQUEST_COMPLETE_TO_REOPEN.key,
        sourceType: ADMIN_SOURCE_TYPES.SERVICES,
        sourceId: maintenanceRequest.id,
        generatedBy: admin.id,
      });
    } else {
      eventEmitter.emit("admin_level_notification", {
        flatId: maintenanceRequest.flatId,
        actionType: ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_ASSIGNEE.key,
        sourceType: ADMIN_SOURCE_TYPES.SERVICES,
        sourceId: maintenanceRequest.id,
        generatedBy: admin.id,
      });
    }

    if (
      maintenanceRequest.userId &&
      (await getUser({ id: maintenanceRequest.userId }))
    ) {
      eventEmitter.emit("flat_level_notification", {
        flatId: maintenanceRequest.flatId,
        actionType: ACTION_TYPES.REQUEST_STATUS_CHANGE.key,
        sourceType: SOURCE_TYPES.MAINTENANCE,
        sourceId: maintenanceRequest.id,
        generatedBy: null,
        metaData: { status: requestStatus },
      });
    }

    const query = `
    select f.name_en as "flatName", f.floor, b.name_en as "buildingName" from flats f
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    where f.id = :flatId and f."deletedAt" is null`;
    Promise.all([
      db.sequelize.query(query, {
        type: db.Sequelize.QueryTypes.SELECT,
        raw: true,
        replacements: {
          flatId: maintenanceRequest.flatId,
        },
      }),
      getCategory({ id: maintenanceRequest.categoryId }),
    ])
      .then(async ([flatDetail, category]) => {
        const messageTemplateObj = {
          staffName: staff.name,
          category: category.name_en,
          flatName: flatDetail[0].flatName,
          floor: flatDetail[0].floor,
          buildingName: flatDetail[0].buildingName,
          staffTime: `${moment(staffCalender[0].timeSlot.startTime)
            .tz(TIMEZONES.UAE)
            .format("LL")}, ${moment(staffCalender[0].timeSlot.startTime)
            .tz(TIMEZONES.UAE)
            .format("LT")} - ${moment(staffCalender[0].timeSlot.endTime)
            .tz(TIMEZONES.UAE)
            .format("LT")}`,
        };
        const textContent = requestAssignment(messageTemplateObj);
        if (env == ENVIRONMENTS.PROD) {
          sendSMS(staff.mobileNumber, textContent)
            .then(() =>
              logger.info(
                `SMS sent to ${staff.mobileNumber} for requestAssignment`
              )
            )
            .catch((err) => {
              console.log(err);
              logger.error(
                `Error while sending SMS for requestAssignment: ${JSON.stringify(
                  err
                )}`
              );
            });
        }
      })
      .catch((err) => {
        logger.error(`Error in assignStaff query: ${JSON.stringify(err)}`);
      });

    return { maintenanceRequest, assignedStaff: staff };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

//remove assigned staff from maintenance request
const removeStaff = async (params) => {
  const maintenanceRequest = await MaintenanceRequest.findOne({
    where: params,
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });
  if (!maintenanceRequest) {
    throw new AppError("removeStaff", "Request not found", "custom", 404);
  }
  if (!maintenanceRequest.staffId) {
    throw new AppError(
      "removeStaff",
      "No staff assigned to this request",
      "custom",
      412
    );
  }

  if (
    maintenanceRequest.statusDetails[0].status ==
      MAINTENANCE_STATUSES.COMPLETED.key ||
    maintenanceRequest.statusDetails[0].status ==
      MAINTENANCE_STATUSES.CANCELLED.key
  ) {
    throw new AppError(
      "removeStaff",
      `Request already ${maintenanceRequest.statusDetails[0].status}`,
      "custom",
      412
    );
  } else if (
    !new Array(
      MAINTENANCE_STATUSES.ASSIGNED.key,
      MAINTENANCE_STATUSES.RE_ASSIGNED.key
    ).includes(maintenanceRequest.statusDetails[0].status)
  ) {
    throw new AppError(
      "removeStaff",
      "Staff cannot be removed at this stage",
      "custom",
      412
    );
  }

  const requestStatusData = {
    maintenanceId: maintenanceRequest.id,
    status:
      maintenanceRequest.statusDetails[0].status ==
      MAINTENANCE_STATUSES.ASSIGNED.key
        ? MAINTENANCE_STATUSES.PENDING.key
        : MAINTENANCE_STATUSES.PROCESSING.key,
  };

  const transaction = await db.sequelize.transaction();
  try {
    //change staff availability to available
    await updateStaffTimeSlots(
      { status: STAFF_AVAILABILITY_STATUS.AVAILABLE },
      { id: maintenanceRequest.staffTimeSlot.staffTimeSlotIds },
      transaction
    );
    //empty staffId and staffTimeSlot
    maintenanceRequest.set({ staffId: null, staffTimeSlot: null });
    await maintenanceRequest.save({ transaction });

    //change status back to pending or in-process depending on current stage
    await MaintenanceStatus.create(requestStatusData, { transaction });
    await transaction.commit();
    return;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

//get all requests - to be viewed by admin
const getRequests = async (
  params,
  { limit, offset },
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) => {
  if (params.startDate && params.endDate) {
    params.startDate = moment(
      getDateTimeObjectFromTimezone(params.startDate, timezone)
    )
      .tz(timezone)
      .startOf("day")
      .format();
    params.endDate = moment(
      getDateTimeObjectFromTimezone(params.endDate, timezone)
    )
      .tz(timezone)
      .endOf("day")
      .format();
    if (params.startDate > params.endDate) {
      throw new AppError(
        "getRequests",
        "Start Date cannot be greater than End Date",
        "custom",
        412
      );
    }
  }

  const query = `
  SELECT mr.*, ms.id as "statusDetails.id", ms."maintenanceId" as "statusDetails.maintenanceId", ms.status as "statusDetails.status", 
  ms.comment as "statusDetails.comment", ms.files as "statusDetails.files", ms."metaData" as "statusDetails.metaData", ms."createdAt" as "statusDetails.createdAt",
  u.id AS "user.id", u.name AS "user.name", 
  f.id AS "flat.id", f.name_en AS "flat.name_en", f.name_ar AS "flat.name_ar", 
  b.id AS "flat.building.id", b.name_en AS "flat.building.name_en", b.name_ar AS "flat.building.name_ar", 
  s.id AS "staff.id", s.name AS "staff.name", s.email AS "staff.email", s."countryCode" AS "staff.countryCode", s."mobileNumber" AS "staff.mobileNumber", s."profilePicture" AS "staff.profilePicture",
  mc.name_en as "category.name_en", mc.name_ar as "category.name_ar", mc.image as "category.image",
  mc1.name_en as "subCategory.name_en", mc1.name_ar as "subCategory.name_ar", mc1.image as "subCategory.image",
  COUNT (*) OVER () as count
  FROM maintenance_requests mr 
  JOIN (
      select distinct on("maintenanceId") * from maintenance_statuses 
      where "deletedAt" is null 
      order by "maintenanceId", "createdAt" desc
  ) ms on ms."maintenanceId" = mr.id ${
    params.status ? `and ms.status ='${params.status}'` : ""
  }
  JOIN maintenance_categories as mc ON "mr"."categoryId" = "mc"."id" 
  LEFT JOIN maintenance_categories mc1 ON mr."subCategoryId" = mc1.id
  LEFT OUTER JOIN users u ON mr."userId" = u.id AND (u."deletedAt" IS NULL) 
  INNER JOIN flats f ON mr."flatId" = f.id AND (f."deletedAt" IS NULL ${
    params.flatId ? `AND f.id = '${params.flatId}'` : ""
  }) 
  LEFT OUTER JOIN buildings b ON f."buildingId" = b.id AND (b."deletedAt" IS NULL) 
  LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND (s."deletedAt" IS NULL) 
  WHERE mr."deletedAt" IS NULL AND ${
    params.buildingId?.length ? `b.id IN (:buildingId)` : `0=1`
  } ${
    params.search
      ? `and (cast(mr."requestId" as text) ilike '%${params.search}%' 
      or mr.type ilike '%${params.search}%'
      or mc.name_en ilike '%${params.search}%'
      or mr.description ilike '%${params.search}%'
      or f.name_en ilike '%${params.search}%'
      or s.name ilike '%${params.search}%'
      or u.name ilike '%${params.search}%'
      or b.name_en ilike '%${params.search}%'
      or cast(mr."createdAt" as text) = '${params.search}' 
      )`
      : ""
  }
  ${params.categoryId ? `and mc.id = '${params.categoryId}'` : ""}
  ${
    params.isUrgent
      ? params.isUrgent === true
        ? `and mr."isUrgent" =${params.isUrgent}`
        : `and mr."isUrgent" =${params.isUrgent}`
      : ``
  }
 ${
   params.isBuilding
     ? params.isBuilding === true
       ? `and mr."isBuilding" =${params.isBuilding}`
       : `and mr."isBuilding" =${params.isBuilding}`
     : ``
 }

  ${
    params.requestId
      ? `and cast(mr."requestId" as text) like '%${params.requestId}%'`
      : ""
  }
  ${
    params.startDate && params.endDate
      ? `and mr."createdAt" >= '${params.startDate}' and mr."createdAt" <= '${params.endDate}'`
      : ""
  }
  ${
    params.subCategoryId
      ? `and mr."subCategoryId" = '${params.subCategoryId}'`
      : ""
  }
  ${
    params.serviceRequestDate
      ? `and DATE(mr."createdAt") = DATE('${params.serviceRequestDate}')`
      : ""
  }
  ${params.isUrgent ? `and mr."isUrgent" is ${params.isUrgent}` : ""}
  ${params.isBuilding ? `and mr."isBuilding" is ${params.isBuilding}` : ""}
  ${params.generatedBy ? `and mr."generatedBy" = '${params.generatedBy}'` : ""}
  ORDER BY mr."createdAt" DESC LIMIT :limit OFFSET :offset`;
  const requests = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      buildingId: params.buildingId,
      limit,
      offset,
    },
  });

  const count = requests[0]?.count ? parseInt(requests[0]?.count) : 0;

  requests.map((request) => {
    if (request.preferredTime?.start) {
      request.preferredTime.start = moment(request.preferredTime.start)
        .tz(timezone)
        .format();
    }
    if (request.preferredTime?.end) {
      request.preferredTime.end = moment(request.preferredTime.end)
        .tz(timezone)
        .format();
    }
    !request.subCategoryId && (request.subCategory = null);
    !request.userId && (request.user = null);
    !request.staffId && (request.staff = null);
    delete request.count;
    request.statusDetails.status =
      MAINTENANCE_STATUSES[request.statusDetails.status][`status_${language}`];
  });
  return { count, rows: requests };
};

//get request details - to be viewed by admin
const getRequestDetails = async (
  params,
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) => {
  let request = await getRequestWithFlatBuildingAndStaff(params);
  if (!request) {
    throw new AppError("getRequestDetails", "Request not found", "custom", 404);
  }
  request = request.get({ plain: true });
  request.maintenanceProducts = await MaintenanceProduct.findAll({
    where: { maintenanceId: request.id },
    include: {
      model: Inventory,
      as: "inventory",
      attributes: [
        "name_en",
        "id",
        "availableQuantity",
        "rate",
        "description",
        "currency",
      ],
    },
  });
  request.statusDetails = await MaintenanceStatus.findAll({
    where: {
      maintenanceId: request.id,
    },
    order: [["createdAt", "DESC"]],
  });

  if (request.preferredTime?.start) {
    request.preferredTime.start = moment(request.preferredTime.start)
      .tz(timezone)
      .format();
  }
  if (request.preferredTime?.end) {
    request.preferredTime.end = moment(request.preferredTime.end)
      .tz(timezone)
      .format();
  }

  request.statusDetails.map((detail) => {
    detail.status = MAINTENANCE_STATUSES[detail.status][`status_${language}`];
  });
  if (request.staff) {
    request.staff.department = DEPARTMENT_TYPES[request.staff.department];
    request.staff.designation = DESIGNATION_TYPES[request.staff.designation];
    request.staff.appointment = APPOINTMENT_TYPES[request.staff.appointment];
  }
  return request;
};

//change status of a request
const changeRequestStatus = async (data, timezone = TIMEZONES.INDIA) => {
  if (!data.requestId) {
    throw new AppError(
      "changeRequestStatus",
      "Request ID is required",
      "custom",
      412
    );
  }
  const request = await getMaintenanceRequest({ id: data.requestId });
  if (!request) {
    throw new AppError(
      "changeRequestStatus",
      "Request not found",
      "custom",
      404
    );
  }
  const { status, createdAt } = (
    await MaintenanceStatus.findAll({
      where: {
        maintenanceId: request.id,
      },
      order: [["createdAt", "DESC"]],
      limit: 1,
    })
  )[0];

  if (status == MAINTENANCE_STATUSES.CANCELLED.key) {
    throw new AppError(
      "changeRequestStatus",
      "Cannot change status of cancelled request",
      "custom",
      412
    );
  } else if (
    status == MAINTENANCE_STATUSES.COMPLETED.key &&
    moment().diff(moment(createdAt), "hours") >= 48
  ) {
    throw new AppError(
      "changeRequestStatus",
      "Request cannot be re-opened after 48 hours of completion",
      "custom",
      412
    );
  }

  if (
    !data.status ||
    !Object.keys(MAINTENANCE_STATUSES).includes(data.status)
  ) {
    throw new AppError(
      "changeRequestStatus",
      "Enter valid status",
      "custom",
      412
    );
  }
  if (
    status != MAINTENANCE_STATUSES.PENDING.key &&
    (data.status == MAINTENANCE_STATUSES.CANCELLED.key ||
      data.status == MAINTENANCE_STATUSES.PENDING.key)
  ) {
    throw new AppError(
      "changeRequestStatus",
      `Ongoing request cannot be marked as ${data.status}`,
      "custom",
      412
    );
  } else if (status == data.status) {
    throw new AppError(
      "changeRequestStatus",
      "You cannot update the same status again",
      "custom",
      412
    );
  }

  await request.update({ status: data.status });
  await MaintenanceStatus.create({
    maintenanceId: request.id,
    status: data.status,
    comment: data?.comment,
    files: data?.files,
  });

  const updateTime = moment().tz(timezone).format("DD MMM YYYY HH:mm A");

  let user = null;

  Promise.all([
    getFlatWithBuilding({ id: request.flatId }),
    getCategory({ id: request.categoryId }),
  ]).then(async ([flatDetail, requestCategory]) => {
    const emailObj = {
      ticketNo: request.requestId,
      category: requestCategory?.name_en,
      flatName: flatDetail.get("name"),
      buildingName: flatDetail?.building?.get("name"),
      dateOfRequest: moment(request.createdAt).format("DD MMM YYYY"),
      createdTime: moment(request.createdAt).format("HH:mm:ss A"),
      isUrgent: request.isUrgent ? "Yes" : "No",
      description: request.description,
      finalComment: data?.comment ? data.comment : "NA",
      timeSlot:
        request.preferredTime &&
        request.preferredTime.start &&
        request.preferredTime.end
          ? `${moment(request.preferredTime.start).format(
              "DD MMM YYYY"
            )}, ${moment(request.preferredTime.start)
              .tz(timezone)
              .format("HH:mm A")} - ${moment(request.preferredTime.end)
              .tz(timezone)
              .format("HH:mm A")}`
          : null,
    };

    let staff = null;

    if (request.userId) {
      user = await getUser({ id: request.userId });
      if (user) {
        emailObj.residentName = user.name;
      }
    }
    if (request.staffId) {
      staff = await getStaff({ id: request.staffId });
      emailObj.staff = staff.name;
    }

    if (data.status == MAINTENANCE_STATUSES.COMPLETED.key) {
      if (user) {
        //send email to user for completion
        requestCompletedForUser(user.email, emailObj);
      }
      //send email to admin for completion
      requestCompletedForAdmin(data.adminEmail, emailObj);
      eventEmitter.emit("admin_level_notification", {
        flatId: request.flatId,
        actionType:
          ADMIN_ACTION_TYPES.SERVICE_REQUEST_INPROCESS_TO_COMPLETE.key,
        sourceType: ADMIN_SOURCE_TYPES.SERVICES,
        sourceId: request.id,
        generatedBy: data.adminId,
      });
    } else {
      //send email to admin for status change
      const statusChangeEmailObj = {
        ticketNo: request.requestId,
        flatName: flatDetail.get("name"),
        buildingName: flatDetail?.building?.get("name"),
        category: requestCategory?.name_en,
        previousStatus: MAINTENANCE_STATUSES[status]["status_en"],
        currentStatus: MAINTENANCE_STATUSES[data.status]["status_en"],
        updatedAt: updateTime,
        residentName: user ? user.name : null,
        staff: staff ? staff.name : null,
      };
      requestStatusChangeForAdmin(data.adminEmail, statusChangeEmailObj);
      if (
        status == MAINTENANCE_STATUSES.PENDING.key &&
        data.status == MAINTENANCE_STATUSES.PROCESSING.key
      ) {
        eventEmitter.emit("admin_level_notification", {
          flatId: request.flatId,
          actionType: ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_INPROCESS.key,
          sourceType: ADMIN_SOURCE_TYPES.SERVICES,
          sourceId: request.id,
          generatedBy: data.adminId,
        });
      } else if (
        status == MAINTENANCE_STATUSES.COMPLETED.key &&
        data.status == MAINTENANCE_STATUSES.RE_OPEN.key
      ) {
        eventEmitter.emit("admin_level_notification", {
          flatId: request.flatId,
          actionType: ADMIN_ACTION_TYPES.SERVICE_REQUEST_COMPLETE_TO_REOPEN.key,
          sourceType: ADMIN_SOURCE_TYPES.SERVICES,
          sourceId: request.id,
          generatedBy: data.adminId,
        });
      }
      if (user) {
        //send email to user for status change
        requestStatusChangeForUser(user.email, statusChangeEmailObj);
      }
    }

    if (request.userId && user) {
      eventEmitter.emit("flat_level_notification", {
        flatId: request.flatId,
        actionType: ACTION_TYPES.REQUEST_STATUS_CHANGE.key,
        sourceType: SOURCE_TYPES.MAINTENANCE,
        sourceId: request.id,
        generatedBy: null,
        metaData: { status: data.status },
      });
    }
  });
  return `Request marked as ${MAINTENANCE_STATUSES[data.status]["status_en"]}`;
};

//create new maintenance request - admin
const createRequestForFlat = async (
  data,
  admin,
  timezone = TIMEZONES.INDIA
) => {
  if (!data.type || !Object.keys(MAINTENANCE_TYPES).includes(data.type)) {
    throw new AppError(
      "createRequestForFlat",
      "Invalid Maintenance Type",
      "custom",
      412
    );
  }
  if (!data.categoryId) {
    throw new AppError(
      "createRequestForFlat",
      "Please add category Id",
      "custom",
      412
    );
  }

  const category = await getCategoryFromFlat({
    flatId: data.flatId,
    categoryId: data.categoryId,
  });

  if (!category) {
    throw new AppError(
      "createRequestForFlat",
      "Category not found",
      "custom",
      404
    );
  }
  if (!data.description) {
    throw new AppError(
      "createRequestForFlat",
      "Please add a description",
      "custom",
      412
    );
  }
  if (!data.flatId) {
    throw new AppError(
      "createRequestForFlat",
      "Flat Id is required",
      "custom",
      412
    );
  }

  if (!data.time) {
    throw new AppError(
      "createRequestForFlat",
      "Time preference is required",
      "custom",
      412
    );
  } else if (moment(data.time) < moment()) {
    throw new AppError(
      "createRequestForFlat",
      "Selected time has passed",
      "custom",
      412
    );
  }
  //TODO: add check if current admin has access to this flat
  const user = await getUser({ flatId: data.flatId });
  if (user) {
    data.userId = user.id;
  }

  const start = moment(data.time)
    .set({
      minute: "00",
      second: "00",
      millisecond: "00",
    })
    .tz(TIMEZONES.UAE);
  const end = moment(start).add(1, "h");
  data.preferredTime = {
    start: start.utc().format(),
    end: end.utc().format(),
  };

  delete data.time;

  const request = await MaintenanceRequest.create(data);
  if (request) {
    await MaintenanceStatus.create({
      maintenanceId: request.id,
      status: MAINTENANCE_STATUSES.PENDING.key,
      comment: data?.comment,
      files: data?.files,
    });
  }
  return request;
};

const updateRequestAdmin = async (
  data,
  timezone = TIMEZONES.INDIA,
  language = LANGUAGES.EN
) => {
  const request = await MaintenanceRequest.findOne({
    where: {
      id: data.id,
    },
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });

  if (!request) {
    throw new AppError(
      "updateRequestAdmin",
      "Request not found",
      "custom",
      404
    );
  }

  if (data.categoryId) {
    const category = await getCategoryFromFlat(
      { flatId: request.flatId, categoryId: data.categoryId },
      language
    );

    if (!category) {
      throw new AppError(
        "updateRequestAdmin",
        "Category not found",
        "custom",
        404
      );
    }
    if (!category.isVisible) {
      throw new AppError(
        "updateRequestAdmin",
        "Category not visible to the user",
        "custom",
        412
      );
    }
  }

  if (
    data.subCategoryId &&
    !(await getCategory({
      id: data.subCategoryId,
      propertyId: data.propertyId,
    }))
  ) {
    throw new AppError(
      "updateRequestAdmin",
      "Sub category not found",
      "custom",
      404
    );
  }

  if (request.statusDetails[0].status != MAINTENANCE_STATUSES.PENDING.key) {
    throw new AppError(
      "updateRequestAdmin",
      "Cannot edit an ongoing request",
      "custom",
      412
    );
  }
  if (request.generatedBy != MAINTENANCE_REQUESTED_BY.ADMIN && data.flatId) {
    throw new AppError(
      "updateRequestAdmin",
      "Cannot edit resident details when generated by user",
      "custom",
      412
    );
  }
  if (data.time) {
    if (moment(data.time) < moment()) {
      throw new AppError(
        "updateRequestAdmin",
        "Time has passed",
        "custom",
        412
      );
    }
    const start = moment(data.time)
      .set({
        minute: "00",
        second: "00",
        millisecond: "00",
      })
      .tz(TIMEZONES.UAE);
    const end = moment(start).add(1, "h");
    data.preferredTime = {
      start: start.utc().format(),
      end: end.utc().format(),
    };
  }
  delete data.time;
  delete data.id;
  delete data.generatedBy;
  delete data.status;

  for (const key in data) {
    request[key] = data[key];
  }
  await request.save();

  eventEmitter.emit("admin_level_notification", {
    flatId: request.flatId,
    actionType: ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_INPROCESS.key,
    sourceType: ADMIN_SOURCE_TYPES.SERVICES,
    sourceId: request.id,
    generatedBy: data.adminId,
  });
  return null;
};

const updateRequestStatusCron = async (timezone = TIMEZONES.INDIA) => {
  const query = `
  select mr.* from maintenance_requests mr join 
  (
    select distinct on("maintenanceId") * from maintenance_statuses 
    where "deletedAt" is null 
    order by "maintenanceId", "createdAt" desc
  ) ms
  on ms."maintenanceId" = mr.id
  where mr."deletedAt" is null AND
  ms.status = any (Array [:statuses]) AND
  mr."staffTimeSlot" is not null AND
  TO_TIMESTAMP(mr."staffTimeSlot"->>'start', :timeFormat) = :currentTime`;

  const requests = await db.sequelize.query(query, {
    raw: true,
    nest: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      statuses: new Array(
        MAINTENANCE_STATUSES.ASSIGNED.key,
        MAINTENANCE_STATUSES.RE_ASSIGNED.key
      ),
      currentTime: moment()
        .tz(timezone)
        .set({
          minute: "00",
          second: "00",
          millisecond: "00",
        })
        .utc()
        .format(),
      timeFormat: "YYYY MM DD T HH24:MI:SS",
    },
  });

  for (let request of requests) {
    await MaintenanceStatus.create({
      maintenanceId: request.id,
      status: MAINTENANCE_STATUSES.PROCESSING.key,
    });
    if (request.userId) {
      eventEmitter.emit("flat_level_notification", {
        flatId: request.flatId,
        actionType: ACTION_TYPES.REQUEST_STATUS_CHANGE.key,
        sourceType: SOURCE_TYPES.MAINTENANCE,
        sourceId: request.id,
        generatedBy: null,
        metaData: { status: MAINTENANCE_STATUSES.PROCESSING.key },
      });
    }
    logger.info(
      `Request with id: ${request.id} marked as ${MAINTENANCE_STATUSES.PROCESSING.key}`
    );
  }
  return `${requests.length} requests marked as ${MAINTENANCE_STATUSES.PROCESSING.key}`;
};

const createRequests = async (data, timezone = TIMEZONES.INDIA) => {
  const reference = "createRequests";
  if (!Array.isArray(data.requests) || !data.requests.length) {
    throw new AppError(reference, "Enter valid requests", "custom", 422);
  }
  if (!data.flatId) {
    throw new AppError(reference, "Flat Id is required", "custom", 422);
  }

  const flat = await getFlat({ id: data.flatId });

  const responseArr = [];
  for (let request of data.requests) {
    const transaction = await db.sequelize.transaction();
    try {
      if (!request.categoryId) {
        throw new AppError(reference, "Please add category Id", "custom", 422);
      }
      const category = await getCategoryFromFlat({
        flatId: data.flatId,
        categoryId: request.categoryId,
      });

      if (!category) {
        throw new AppError(reference, "Category not found", "custom", 404);
      }
      if (!category.isVisible) {
        throw new AppError(
          reference,
          "Selected category not visible to the user",
          "custom",
          412
        );
      }

      if (request.subCategoryId) {
        const subCategory = await getCategory({
          id: request.subCategoryId,
          propertyId: data.propertyId,
        });
        if (!subCategory) {
          throw new AppError(
            reference,
            "Sub category not found",
            "custom",
            404
          );
        }
      }

      if (!request.description) {
        throw new AppError(
          reference,
          "Please add a description",
          "custom",
          422,
          [
            {
              column: "description",
              message: "Please add a description",
            },
          ]
        );
      }

      if (!request.time) {
        throw new AppError(
          reference,
          "Time preference is required",
          "custom",
          422,
          [
            {
              column: "time",
              message: "Time preference is required",
            },
          ]
        );
      } else if (moment(request.time) < moment()) {
        throw new AppError(
          reference,
          "Selected time for this request has passed",
          "custom",
          412,
          [
            {
              column: "time",
              message: "Selected time for this request has passed",
            },
          ]
        );
      }
      request.flatId = data.flatId;
      request.generatedBy = data.generatedBy;
      const user = await getUser({ flatId: request.flatId });
      if (user) {
        request.userId = user.id;
      }

      const start = moment(request.time)
        .set({
          minute: "00",
          second: "00",
          millisecond: "00",
        })
        .tz(TIMEZONES.UAE);
      const end = moment(start).add(1, "h");
      request.preferredTime = {
        start: start.utc().format(),
        end: end.utc().format(),
      };

      delete request.time;

      const newRequest = await MaintenanceRequest.create(request, {
        transaction,
      });
      if (newRequest) {
        await MaintenanceStatus.create(
          {
            maintenanceId: newRequest.id,
            status: MAINTENANCE_STATUSES.PENDING.key,
            comment: data?.comment,
            files: data?.files,
          },
          { transaction }
        );
      }

      await transaction.commit();

      responseArr.push({
        success: true,
        id: newRequest.id,
        requestId: newRequest.requestId,
        type: newRequest.type,
        preferredTime: newRequest.preferredTime,
      });
      const emailObj = {
        ticketNo: newRequest.requestId,
        residentName: user ? user.name : null,
        flatName: flat.get("name"),
        dateOfRequest: moment(newRequest.createdAt).format("DD MMM YYYY"),
        createdTime: moment(newRequest.createdAt).format("HH:mm:ss A"),
        isUrgent: newRequest.isUrgent ? "Yes" : "No",
        category: category.name,
        description: newRequest.description,
        timeSlot: `${moment(newRequest.preferredTime.start).format(
          "DD MMM YYYY"
        )}, ${moment(newRequest.preferredTime.start)
          .tz(timezone)
          .format("HH:mm A")} - ${moment(newRequest.preferredTime.end)
          .tz(timezone)
          .format("HH:mm A")}`,
      };
      if (user) {
        //send email to user
        requestCreatedForUser(user.email, emailObj);
      }
      //send email to admin
      getBuilding({ id: flat.buildingId })
        .then((building) => {
          requestCreatedForAdmin(data.adminEmail, {
            ...emailObj,
            buildingName: building.get("name"),
            adminName: data.adminName,
          });
        })
        .catch();
    } catch (error) {
      logger.warn(error.message);
      await transaction.rollback();
      responseArr.push({
        success: false,
        column: error?.errors?.[0]?.column
          ? error.errors[0].column
          : "Anonymous",
        message: error?.errors?.[0]?.message
          ? error.errors[0].message
          : error.message,
      });
    }
  }
  return responseArr;
};

const addFilesToRequest = async ({ id, files }) => {
  const request = await MaintenanceRequest.findOne({
    where: { id },
  });
  if (!request) {
    throw new AppError("addFilesToRequest", "Request not found", "custom", 404);
  }
  let filesArray;
  if (request.files) {
    filesArray = [...request.files];
  } else {
    filesArray = [];
  }
  files.map((file) =>
    filesArray.push({
      name: file.originalName,
      url: file.location,
      type: file.contentType,
    })
  );

  request.set({
    files: filesArray,
  });
  await request.save();
  return "Files added successfully";
};

const addFilesToRequestUpdated = async ({ id, files, propertyId }) => {
  const request = await MaintenanceRequest.findOne({
    where: { id, "$flat.building.propertyId$": propertyId },

    include: [
      {
        model: Flat,
        as: "flat",
        required: true,
        attributes: [],

        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: [],
        },
      },
    ],
  });
  if (!request) {
    throw new AppError("addFilesToRequest", "Request not found", "custom", 404);
  }

  request.set({
    files,
  });
  await request.save();
  return null;
};

const editStaffTimingForRequest = async (data, timezone = TIMEZONES.INDIA) => {
  if (!data.requestId) {
    throw new AppError(
      "editStaffTimingForRequest",
      "Request Id is required",
      "custom",
      422
    );
  }

  //check for staffs timeslots coming in payload
  if (
    !data.staffTimeSlots ||
    !Array.isArray(data.staffTimeSlots) ||
    !data.staffTimeSlots.length
  ) {
    throw new AppError(
      "editStaffTimingForRequest",
      "Staff time slot is required",
      "custom",
      412
    );
  }

  const maintenanceRequest = await MaintenanceRequest.findOne({
    where: { id: data.requestId },
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });
  if (!maintenanceRequest) {
    throw new AppError(
      "editStaffTimingForRequest",
      "Request not found",
      "custom",
      404
    );
  }
  if (!maintenanceRequest.staffId) {
    throw new AppError(
      "editStaffTimingForRequest",
      "No staff assigned to this request",
      "custom",
      412
    );
  }

  if (
    maintenanceRequest.statusDetails[0].status ==
      MAINTENANCE_STATUSES.COMPLETED.key ||
    maintenanceRequest.statusDetails[0].status ==
      MAINTENANCE_STATUSES.CANCELLED.key
  ) {
    throw new AppError(
      "editStaffTimingForRequest",
      `Request already ${maintenanceRequest.statusDetails[0].status}`,
      "custom",
      412
    );
  } else if (
    !new Array(
      MAINTENANCE_STATUSES.ASSIGNED.key,
      MAINTENANCE_STATUSES.RE_ASSIGNED.key
    ).includes(maintenanceRequest.statusDetails[0].status)
  ) {
    throw new AppError(
      "editStaffTimingForRequest",
      "Staff details cannot be edited at this stage",
      "custom",
      412
    );
  }

  //check for staff availability from payload's timeslots
  const staffCalender = await getStaffSlotsWithTime({
    id: data.staffTimeSlots,
    staffId: maintenanceRequest.staffId,
  });

  if (!staffCalender.length) {
    throw new AppError(
      "editStaffTimingForRequest",
      "Staff schedule not found",
      "custom",
      404
    );
  }

  let ids = [];

  staffCalender.map((calender) => {
    const timeCheck =
      moment().tz(timezone) > moment(calender.timeSlot.startTime).tz(timezone);
    if (timeCheck) {
      throw new AppError(
        "editStaffTimingForRequest",
        "Selected time has passed",
        "custom",
        412
      );
    }
    if (calender.status != STAFF_AVAILABILITY_STATUS.AVAILABLE) {
      throw new AppError(
        "editStaffTimingForRequest",
        "Staff not available for given time slot",
        "custom",
        412
      );
    }
    ids.push(calender.id);
  });

  const transaction = await db.sequelize.transaction();
  try {
    //mark prev timeslots as available if mentioned time hasn't passed
    if (
      moment().tz(timezone) <
      moment(maintenanceRequest.staffTimeSlot.start).tz(timezone)
    ) {
      await StaffTimeslot.update(
        { status: STAFF_AVAILABILITY_STATUS.AVAILABLE },
        {
          where: { id: maintenanceRequest.staffTimeSlot.staffTimeSlotIds },
          transaction,
        }
      );
    }

    //mark new timeslots as booked
    await StaffTimeslot.update(
      { status: STAFF_AVAILABILITY_STATUS.BOOKED },
      { where: { id: ids }, transaction }
    );

    //update request with new time slot
    await MaintenanceRequest.update(
      {
        staffTimeSlot: {
          start: staffCalender[0].timeSlot.startTime,
          end: staffCalender[staffCalender.length - 1].timeSlot.endTime,
          staffTimeSlotIds: ids,
        },
      },
      { where: { id: maintenanceRequest.id }, transaction }
    );

    //update timings in status table
    await MaintenanceStatus.update(
      {
        metaData: {
          ...JSON.parse(
            JSON.stringify(maintenanceRequest.statusDetails[0].metaData)
          ),
          timeSlot: {
            start: staffCalender[0].timeSlot.startTime,
            end: staffCalender[staffCalender.length - 1].timeSlot.endTime,
          },
        },
      },
      { where: { id: maintenanceRequest.statusDetails[0].id }, transaction }
    );

    await transaction.commit();
    return;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

//get incomplete requests - to be viewed by admin
const getIncompleteRequests = async (
  params,
  { limit, offset },
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) => {
  // Early return if no buildings are found
  if (!params.buildingId || params.buildingId.length === 0) {
    return { count: 0, rows: [] };
  }

  // Handle date range if provided
  if (params.startDate && params.endDate) {
    params.startDate = moment(
      getDateTimeObjectFromTimezone(params.startDate, timezone)
    )
      .tz(timezone)
      .startOf("day")
      .format();
    params.endDate = moment(
      getDateTimeObjectFromTimezone(params.endDate, timezone)
    )
      .tz(timezone)
      .endOf("day")
      .format();
    
    if (params.startDate > params.endDate) {
      throw new AppError(
        "getIncompleteRequests",
        "Start Date cannot be greater than End Date",
        "custom",
        412
      );
    }
  }

  // Build the query parts
  const whereClauses = [
    'mr."deletedAt" IS NULL',
    'f."buildingId" IN (:buildingId)',
    params.status ? 'ms.status = :status' : 'ms.status <> :status',
    params.flatId ? 'f.id = :flatId' : null,
    params.type ? 'mr.type = :type' : null,
    params.requestId ? 'CAST(mr."requestId" AS TEXT) LIKE :requestId' : null,
    params.startDate && params.endDate 
      ? 'mr."createdAt" BETWEEN :startDate AND :endDate' 
      : null,
    params.categoryId ? 'mr."categoryId" = :categoryId' : null,
    params.isUrgent ? 'mr."isUrgent" = :isUrgent' : null,
    params.isBuilding ? 'mr."isBuilding" = :isBuilding' : null,
    params.generatedBy ? 'mr."generatedBy" = :generatedBy' : null
  ].filter(Boolean);

  // Add search conditions if needed
  let searchCondition = '';
  if (params.search) {
    searchCondition = `AND (
      CAST(mr."requestId" AS TEXT) ILIKE :search OR
      mr.type ILIKE :search OR
      mr.description ILIKE :search OR
      f.name_en ILIKE :search OR
      s.name ILIKE :search OR
      u.name ILIKE :search OR
      b.name_en ILIKE :search OR
      CAST(mr."createdAt" AS TEXT) ILIKE :search
    )`;
  }

  const query = `
    SELECT 
      mr.*, 
      ms.id as "statusDetails.id", 
      ms."maintenanceId" as "statusDetails.maintenanceId", 
      ms.status as "statusDetails.status", 
      ms.comment as "statusDetails.comment", 
      ms.files as "statusDetails.files", 
      ms."metaData" as "statusDetails.metaData", 
      ms."createdAt" as "statusDetails.createdAt",
      u.id AS "user.id", 
      u.name AS "user.name", 
      f.id AS "flat.id", 
      f.name_en AS "flat.name_en", 
      f.name_ar AS "flat.name_ar", 
      b.id AS "flat.building.id", 
      b.name_en AS "flat.building.name_en", 
      b.name_ar AS "flat.building.name_ar", 
      s.id AS "staff.id", 
      s.name AS "staff.name", 
      s.email AS "staff.email", 
      s."countryCode" AS "staff.countryCode", 
      s."mobileNumber" AS "staff.mobileNumber", 
      s."profilePicture" AS "staff.profilePicture",
      mc.name_en as "category.name_en",
      mc.name_ar as "category.name_ar", 
      mc.image as "category.image",
      mc1.name_en as "subCategory.name_en",
      mc1.name_ar as "subCategory.name_ar", 
      mc1.image as "subCategory.image",
      COUNT(*) OVER () as count
    FROM maintenance_requests mr 
    JOIN (
      SELECT DISTINCT ON("maintenanceId") * 
      FROM maintenance_statuses 
      WHERE "deletedAt" IS NULL 
      ORDER BY "maintenanceId", "createdAt" DESC
    ) ms ON ms."maintenanceId" = mr.id
    JOIN maintenance_categories as mc ON "mr"."categoryId" = "mc"."id" 
    LEFT JOIN maintenance_categories as mc1 ON mr."subCategoryId" = mc1.id
    LEFT OUTER JOIN users u ON mr."userId" = u.id AND u."deletedAt" IS NULL
    INNER JOIN flats f ON mr."flatId" = f.id AND f."deletedAt" IS NULL
    LEFT OUTER JOIN buildings b ON f."buildingId" = b.id AND b."deletedAt" IS NULL
    LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND s."deletedAt" IS NULL
    WHERE ${whereClauses.join(' AND ')}
    ${searchCondition}
    ORDER BY mr."createdAt" ASC 
    LIMIT :limit OFFSET :offset
  `;

  // Prepare replacements
  const replacements = {
    buildingId: params.buildingId,
    status: params.status || MAINTENANCE_STATUSES.COMPLETED.key,
    limit,
    offset,
    ...(params.flatId && { flatId: params.flatId }),
    ...(params.type && { type: params.type }),
    ...(params.requestId && { requestId: `%${params.requestId}%` }),
    ...(params.startDate && params.endDate && { 
      startDate: params.startDate,
      endDate: params.endDate
    }),
    ...(params.categoryId && { categoryId: params.categoryId }),
    ...(params.isUrgent && { isUrgent: params.isUrgent === 'true' }),
    ...(params.isBuilding && { isBuilding: params.isBuilding === 'true' }),
    ...(params.generatedBy && { generatedBy: params.generatedBy }),
    ...(params.search && { search: `%${params.search}%` })
  };

  try {
    const requests = await db.sequelize.query(query, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements
    });

    const count = requests[0]?.count ? parseInt(requests[0]?.count) : 0;

    // Process and return the results
    const processedRequests = requests.map((request) => {
      if (request.preferredTime?.start) {
        request.preferredTime.start = moment(request.preferredTime.start)
          .tz(timezone)
          .format();
      }
      if (request.preferredTime?.end) {
        request.preferredTime.end = moment(request.preferredTime.end)
          .tz(timezone)
          .format();
      }
      request.statusDetails.status =
        MAINTENANCE_STATUSES[request.statusDetails.status]?.[`status_${language}`] || 
        request.statusDetails.status;
      request.type = request.type && 
        MAINTENANCE_TYPES[request.type]?.[`type_${language}`] || 
        request.type;
      !request.subCategoryId && (request.subCategory = null);
      !request.userId && (request.user = null);
      !request.staffId && (request.staff = null);
      delete request.count;
      return request;
    });

    return { count, rows: processedRequests };
  } catch (error) {
    console.error('Error in getIncompleteRequests:', error);
    throw error;
  }
};

async function updateRequestSubCategory(data) {
  const reference = "updateRequestSubCategory";
  if (!data.subCategoryId) {
    throw new AppError(reference, "Sub Category Id is required", "custom", 412);
  }

  const [request, subCategory] = await Promise.all([
    MaintenanceRequest.findOne({
      where: {
        id: data.id,
        "$flat->building.propertyId$": data.propertyId,
      },
      include: [
        {
          model: Flat,
          as: "flat",
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              attributes: [],
            },
          ],
        },
      ],
    }),
    getCategory({ id: data.subCategoryId, propertyId: data.propertyId }),
  ]);
  if (!request) {
    throw new AppError(reference, "Request not found", "custom", 404);
  }
  if (!subCategory) {
    throw new AppError(reference, "Category not found", "custom", 404);
  }
  request.subCategoryId = subCategory.id;
  await request.save();
  return null;
}

const getMaintenanceRequestWithPropertyForExport = async (
  propertyId,
  buildingId,
  categoryId,
  search,
  status,
  isUrgent,
  subCategoryId,
  serviceRequestDate
) => {
  const query = `SELECT mr."requestId", mr."preferredTime" as "requestedTime",
  mr."createdAt" as "createdAt", ms.status as "status",
  b.name_en AS "building",mr."rating" as "rating",u.name AS "username"
  FROM maintenance_requests mr 
  JOIN (
      select distinct on("maintenanceId") * from maintenance_statuses 
      where "deletedAt" is null 
      order by "maintenanceId", "createdAt" desc
  ) ms on ms."maintenanceId" = mr.id ${
    status ? `and ms.status ='${status}'` : ""
  }
  JOIN maintenance_categories as mc ON "mr"."categoryId" = "mc"."id" 
  LEFT OUTER JOIN users u ON mr."userId" = u.id AND (u."deletedAt" IS NULL) 
  INNER JOIN flats f ON mr."flatId" = f.id AND (f."deletedAt" IS NULL) 
  LEFT OUTER JOIN buildings b ON f."buildingId" = b.id AND (b."deletedAt" IS NULL) 
  LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND (s."deletedAt" IS NULL) 
  WHERE mr."deletedAt" IS NULL  ${
    buildingId ? `AND b.id = '${buildingId}'` : ""
  } AND b."propertyId"= :propertyId ${
    search
      ? `and (cast(mr."requestId" as text) ilike '%${search}%' 
      or mr.type ilike '%${search}%'
      or mc.name_en ilike '%${search}%'
      or mr.description ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or s.name ilike '%${search}%'
      or u.name ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or cast(mr."createdAt" as text) = '${search}' 
      )`
      : ""
  }
  ${categoryId ? `and mc.id = '${categoryId}'` : ""}
  ${subCategoryId ? `and mr."subCategoryId" = '${subCategoryId}'` : ""}
  ${
    serviceRequestDate
      ? `and DATE(mr."createdAt") = DATE('${serviceRequestDate}')`
      : ""
  }
  ${isUrgent ? `and mr."isUrgent" is ${isUrgent}` : ""}
  ORDER BY mr."createdAt" DESC
`;
  const requests = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId,
    },
  });

  return requests;
};

const maintenanceRequestStats = async ({ propertyId, buildingId }) => {
  const startDateOfMonth = moment().startOf("month").toDate();
  const currentDate = moment().toDate();
  const previousStartDateOfMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousEndDateOfMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .toDate();

  const statuses = new Array(
    MAINTENANCE_STATUSES.PENDING.key,
    MAINTENANCE_STATUSES.PROCESSING.key,
    MAINTENANCE_STATUSES.COMPLETED.key
  );
  //Logic changed as per the new requirement
  // const queryForOpenRequests = `
  //  SELECT COUNT(DISTINCT ms."maintenanceId")::INTEGER FROM maintenance_statuses ms
  //   JOIN maintenance_requests mr ON (mr.id = ms."maintenanceId" AND mr."deletedAt" IS NULL)
  //   JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL)
  //   JOIN buildings b ON (b.id = f."buildingId" and b."deletedAt" IS NULL AND b."propertyId" = :propertyId
  //   ${buildingId ? `AND b."id" ='${buildingId}'` : ""})
  //   WHERE ms.status = '${
  //     MAINTENANCE_STATUSES.PENDING.key
  //   }' AND ms."deletedAt" IS NULL AND (
  //   ms."createdAt" <= :endDate
  //   AND (:startDate IS NULL OR ms."createdAt" >= :startDate))`;

  const query = `
    SELECT COUNT(DISTINCT mr.id)
    FROM maintenance_requests mr
    LEFT JOIN (
        SELECT DISTINCT ON (ms."maintenanceId") ms.*
        FROM maintenance_statuses ms
        WHERE ms."deletedAt" IS NULL
        ORDER BY ms."maintenanceId", ms."createdAt" DESC
    ) AS ms ON mr.id = ms."maintenanceId"
    JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL AND b."propertyId" = :propertyId ${
      buildingId ? `AND b."id" ='${buildingId}'` : ""
    })
    WHERE ms.status = :status AND ms."deletedAt" IS NULL AND (
        ms."createdAt" <= :endDate
        AND (:startDate IS NULL OR ms."createdAt" >= :startDate)
    )
    `;

  // const [totalOpen, previousMonthOpen] = await Promise.all([
  //   db.sequelize.query(queryForOpenRequests, {
  //     raw: true,
  //     type: db.Sequelize.QueryTypes.SELECT,
  //     replacements: {
  //       startDate: null,
  //       endDate: currentDate,
  //       propertyId,
  //     },
  //   }),
  //   db.sequelize.query(queryForOpenRequests, {
  //     raw: true,
  //     type: db.Sequelize.QueryTypes.SELECT,
  //     replacements: {
  //       startDate: previousStartDateOfMonth,
  //       endDate: previousEndDateOfMonth,
  //       propertyId,
  //     },
  //   }),
  // ]);

  // const Open = {
  //   total: totalOpen[0].count,
  //   previousMonth: previousMonthOpen[0].count,
  // };
  const [Open, inProcess, completed] = await Promise.all(
    statuses.map(async (status) => {
      const [currentMonthStatusCount, previousMonthStatusCount] =
        await Promise.all([
          db.sequelize.query(query, {
            raw: true,
            type: db.Sequelize.QueryTypes.SELECT,
            replacements: {
              status,
              startDate: null,
              endDate: currentDate,
              propertyId,
            },
          }),
          db.sequelize.query(query, {
            raw: true,
            type: db.Sequelize.QueryTypes.SELECT,
            replacements: {
              status,
              startDate: previousStartDateOfMonth,
              endDate: previousEndDateOfMonth,
              propertyId,
            },
          }),
        ]);

      // let percentageDifference = null;
      // if (+previousMonthStatusCount[0]?.count) {
      //   percentageDifference = parseFloat(
      //     (
      //       ((+currentMonthStatusCount[0]?.count -
      //         +previousMonthStatusCount[0]?.count) /
      //         +previousMonthStatusCount[0]?.count) *
      //       100
      //     ).toFixed(2)
      //   );
      // } else if (
      //   !+currentMonthStatusCount[0]?.count &&
      //   !+previousMonthStatusCount[0]?.count
      // ) {
      //   percentageDifference = 0;
      // }
      return {
        [MAINTENANCE_STATUSES[status].status_en]: {
          total: currentMonthStatusCount[0]?.count
            ? +currentMonthStatusCount[0]?.count
            : 0,
          previousMonth: previousMonthStatusCount[0]?.count
            ? +previousMonthStatusCount[0]?.count
            : 0,
          //   percentageDifference,
          //   isIncreasing:
          //     percentageDifference > 0 || percentageDifference == null
          //       ? true
          //       : false,
        },
      };
    })
  );

  return { ...Open, ...inProcess, ...completed };
};

const getMaintenanceBifurcationStatistics = async (
  startDate,
  endDate,
  propertyId
) => {
  const reference = `maintenanceBifurcationStatistics`;
  if (!startDate) {
    throw new AppError(reference, "startDate is required", "custom", 412);
  }

  if (!endDate) {
    throw new AppError(reference, "endDate is required", "custom", 412);
  }

  const query = `select mc."name_en" as name,count(*) as count from maintenance_requests mr
join maintenance_categories mc on mc.id = mr."categoryId" where ( mr."deletedAt" is null and  mr."createdAt" between :startDate and :endDate and mc."propertyId" = :propertyId )
group by mc."name_en"`;
  const maintenanceBifurcations = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
      propertyId,
    },
  });

  const categoriesCount = new Map();
  maintenanceBifurcations.forEach(({ name, count }) => {
    categoriesCount.set(name, +count);
  });

  return Object.fromEntries(categoriesCount);
};

const getMaintenanceBifurcationStatWithBuilding = async (
  startDate,
  endDate,
  propertyId,
  buildingId
) => {
  const reference = `getMaintenanceBifurcationStatWithBuilding`;
  if (!startDate) {
    throw new AppError(reference, "startDate is required", "custom", 412);
  }

  if (!endDate) {
    throw new AppError(reference, "endDate is required", "custom", 412);
  }

  const query = `select mc."name_en" as name,count(*) as count from maintenance_requests mr
join maintenance_categories mc on mc.id = mr."categoryId" 
INNER JOIN "flats" AS "flat" ON mr."flatId" = "flat"."id" AND ("flat"."deletedAt" IS NULL) 
join buildings b on flat."buildingId" = b.id where (b.id = :buildingId and mr."deletedAt" is null and  mr."createdAt" between :startDate and :endDate and mc."propertyId" = :propertyId)
group by mc."name_en"`;
  const maintenanceBifurcations = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
      propertyId,
      buildingId,
    },
  });

  return maintenanceBifurcations;
};

const maintenanceRequestGraph = async (
  startDate,
  endDate,
  bifurcationData,
  propertyId,
  buildingId
) => {
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  const oneYear = 365 * oneDay;
  let result;
  if (timeDifference <= oneDay) {
    const statuses = new Array(
      MAINTENANCE_STATUSES.PENDING.key,
      MAINTENANCE_STATUSES.PROCESSING.key
    );
    const promises = statuses.map(async (status) => {
      const query = `
   SELECT
      TO_CHAR(DATE_TRUNC('hour', ms."createdAt"::timestamp)
      - (DATE_PART('hour', ms."createdAt"::timestamp)::integer % 3) * interval '1 hour', 'HH24:MI')
      || '-'
      || TO_CHAR(DATE_TRUNC('hour', ms."createdAt"::timestamp)
      - (DATE_PART('hour', ms."createdAt"::timestamp)::integer % 3) * interval '1 hour' + interval '3 hours', 'HH24:MI') AS date_time_range,
      COUNT(DISTINCT ms."maintenanceId") AS count
      FROM maintenance_statuses ms
      JOIN maintenance_requests mr ON (mr.id = ms."maintenanceId" AND mr."deletedAt" IS NULL)
      JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL ${
        buildingId ? `AND f."buildingId" ='${buildingId}'` : ""
      })
      JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL AND b."propertyId" = '${propertyId}')
      WHERE
        ms.status = '${status}'
        AND ms."deletedAt" IS NULL
        AND ms."createdAt" BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
      GROUP BY date_time_range
      ORDER BY date_time_range ASC;`;
      result = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      });
      result.map((date) => {
        if (status === MAINTENANCE_STATUSES.PENDING.key) {
          bifurcationData[date.date_time_range].open = parseInt(date.count);
        }
        if (status === MAINTENANCE_STATUSES.PROCESSING.key) {
          bifurcationData[date.date_time_range].inProcess = parseInt(
            date.count
          );
        }
      });
    });
    await Promise.all(promises);
    return bifurcationData;
  } else if (timeDifference <= oneWeek) {
    const statuses = new Array(
      MAINTENANCE_STATUSES.PENDING.key,
      MAINTENANCE_STATUSES.PROCESSING.key
    );
    const promises = statuses.map(async (status) => {
      const query = `
   SELECT
  CASE
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 0 THEN 'Sun'
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 1 THEN 'Mon'
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 2 THEN 'Tue'
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 3 THEN 'Wed'
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 4 THEN 'Thu'
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 5 THEN 'Fri'
    WHEN EXTRACT(DOW FROM ms."createdAt"::timestamp) = 6 THEN 'Sat'
  END AS day_of_week,
  COUNT(DISTINCT ms."maintenanceId") AS count
  FROM maintenance_statuses ms
  JOIN maintenance_requests mr ON (mr.id = ms."maintenanceId" AND mr."deletedAt" IS NULL)
  JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL ${
    buildingId ? `AND f."buildingId" ='${buildingId}'` : ""
  })
  JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL AND b."propertyId" = '${propertyId}')
  WHERE
    ms.status = '${status}'
    AND ms."deletedAt" IS NULL
    AND ms."createdAt" BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
  GROUP BY day_of_week
  ORDER BY day_of_week ASC;
`;
      result = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      });
      result.map((date) => {
        if (status === MAINTENANCE_STATUSES.PENDING.key) {
          bifurcationData[date.day_of_week].open = parseInt(date.count);
        }
        if (status === MAINTENANCE_STATUSES.PROCESSING.key) {
          bifurcationData[date.day_of_week].inProcess = parseInt(date.count);
        }
      });
    });
    await Promise.all(promises);
    return bifurcationData;
  } else if (timeDifference <= thirtyDays) {
    const statuses = new Array(
      MAINTENANCE_STATUSES.PENDING.key,
      MAINTENANCE_STATUSES.PROCESSING.key
    );
    let weekData = {};
    const promises = statuses.map(async (status) => {
      const query = `
        SELECT
          COUNT(DISTINCT ms."maintenanceId") AS count,
          TO_CHAR(DATE_TRUNC('week', ms."createdAt"::timestamp AT TIME ZONE 'UTC'), 'MM/DD')
          || '-'
          || TO_CHAR(DATE_TRUNC('week', ms."createdAt"::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 days - 1 second', 'MM/DD') AS week_date_range
        FROM maintenance_statuses ms
        JOIN maintenance_requests mr ON (mr.id = ms."maintenanceId" AND mr."deletedAt" IS NULL)
        JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL ${
          buildingId ? `AND f."buildingId" ='${buildingId}'` : ""
        })
        JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL AND b."propertyId" = '${propertyId}')
        WHERE
          ms.status = '${status}'
          AND ms."deletedAt" IS NULL
          AND ms."createdAt" BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
        GROUP BY
          week_date_range
        ORDER BY
          week_date_range ASC;`;
      const result = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      });
      result.map((date) => {
        if (!weekData[date.week_date_range]) {
          weekData[date.week_date_range] = {
            open: 0,
            inProcess: 0,
          };
        }
        if (status === MAINTENANCE_STATUSES.PENDING.key) {
          weekData[date.week_date_range].open = parseInt(date.count);
        }

        if (status === MAINTENANCE_STATUSES.PROCESSING.key) {
          weekData[date.week_date_range].inProcess = parseInt(date.count);
        }
      });
    });
    await Promise.all(promises);
    const keyArray = Object.keys(weekData).map((key) => ({
      key,
      value: weekData[key],
    }));

    keyArray.sort((a, b) => {
      const dateA = new Date(a.key.split("-")[0]);
      const dateB = new Date(b.key.split("-")[0]);
      return dateA - dateB;
    });
    const sortedWeekData = {};
    keyArray.forEach((item) => {
      sortedWeekData[item.key] = item.value;
    });

    return Object.keys(weekData).length !== 0
      ? sortedWeekData
      : bifurcationData;
  } else {
    const statuses = new Array(
      MAINTENANCE_STATUSES.PENDING.key,
      MAINTENANCE_STATUSES.PROCESSING.key
    );

    const promises = statuses.map(async (status) => {
      const query = `
     SELECT
  TO_CHAR(ms."createdAt"::timestamp, 'FMMonth') AS month,
  COUNT(DISTINCT ms."maintenanceId") AS count
FROM maintenance_statuses ms
JOIN maintenance_requests mr ON (mr.id = ms."maintenanceId" AND mr."deletedAt" IS NULL)
JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL ${
        buildingId ? `AND f."buildingId" ='${buildingId}'` : ""
      })
JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL AND b."propertyId" = '${propertyId}')
WHERE
  ms.status = '${status}'
  AND ms."deletedAt" IS NULL
  AND ms."createdAt" BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
GROUP BY month
ORDER BY month ASC;
;
  `;
      const result = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      });
      result.map((date) => {
        if (status === MAINTENANCE_STATUSES.PENDING.key) {
          bifurcationData[date.month].open = parseInt(date.count);
        }
        if (status === MAINTENANCE_STATUSES.PROCESSING.key) {
          bifurcationData[date.month].inProcess = parseInt(date.count);
        }
      });
    });
    await Promise.all(promises);
    return bifurcationData;
  }
};

const getMaintenanceAreaAnalytics = async (
  startDate,
  endDate,
  propertyId,
  buildingId
) => {
  const query = `SELECT
       CASE
         WHEN mr."isBuilding" = true THEN 'Common area'
         ELSE 'Private area'
         END AS "areaType",
         COUNT(*) AS count
      FROM maintenance_requests mr
      INNER JOIN "flats" AS "flat" ON mr."flatId" = "flat"."id" AND ("flat"."deletedAt" IS NULL) 
      JOIN buildings b ON flat."buildingId" = b.id AND (b."deletedAt" IS NULL)
      WHERE (mr."deletedAt" IS NULL ${
        buildingId ? `AND b.id = '${buildingId}'` : ""
      } and mr."createdAt" between :startDate and :endDate and b."propertyId" = :propertyId)
      GROUP BY "areaType";
`;
  const maintenanceAreaAnalytics = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
      propertyId,
    },
  });
  const maintenanceData = {
    "Common area": 0,
    "Private area": 0,
  };
  maintenanceAreaAnalytics.forEach((maintenance) => {
    maintenanceData[maintenance.areaType] = parseInt(maintenance.count);
  });
  return maintenanceData;
};
module.exports = {
  assignStaff,
  getRequests,
  getRequestDetails,
  removeStaff,
  changeRequestStatus,
  createRequestForFlat,
  updateRequestAdmin,
  updateRequestStatusCron,
  createRequests,
  addFilesToRequest,
  editStaffTimingForRequest,
  getIncompleteRequests,
  updateRequestSubCategory,
  getMaintenanceRequestWithPropertyForExport,
  maintenanceRequestStats,
  getMaintenanceBifurcationStatistics,
  getMaintenanceBifurcationStatWithBuilding,
  maintenanceRequestGraph,
  getMaintenanceAreaAnalytics,
  addFilesToRequestUpdated,
};
