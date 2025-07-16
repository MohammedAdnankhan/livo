const {
  getBuildings,
  getBuilding,
} = require("../../building-service/controllers/building");
const Building = require("../../building-service/models/Building");
const Charge = require("../../charge-service/models/Charge");
const Payment = require("../../charge-service/models/Payment");
const moment = require("moment-timezone");
const {
  LANGUAGES,
  MAINTENANCE_TYPES,
  MAINTENANCE_STATUSES,
  TIMEZONES,
  REQUEST_CANCEL_REASONS,
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
} = require("../../config/constants");
const Flat = require("../../flat-service/models/Flat");
const Staff = require("../../staff-service/models/Staff");
const User = require("../../user-service/models/User");
const MaintenanceCategory = require("../../maintenanceRequest-service/models/MaintenanceCategory");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const MaintenanceStatus = require("../models/MaintenanceStatus");
const {
  getPropertyFeatureFromFlat,
} = require("../../property-service/controllers/property");
const db = require("../../database");
const { getDateTimeObjectFromTimezone } = require("../../utils/utility");
const { getCategoryFromFlat } = require("./maintenanceCategory");
const {
  requestCreatedForUser,
  requestCreatedForAdmin,
} = require("../../utils/email");
const { getFlat } = require("../../flat-service/controllers/flat");
const { getAdminForFlat } = require("../../admin-service/controllers/admin");
const eventEmitter = require("../../utils/eventEmitter");

//get request types
const getTypes = async (language = LANGUAGES.EN) => {
  let types = [];
  for (const key of Object.keys(MAINTENANCE_TYPES)) {
    const type = MAINTENANCE_TYPES[key][`type_${language}`];
    types.push({ key, type });
  }
  return types;
};

//get statuses list
const getStatusesList = async (language = LANGUAGES.EN) => {
  return Object.keys(MAINTENANCE_STATUSES).map((status) => {
    return {
      key: status,
      status: MAINTENANCE_STATUSES[status][`status_${language}`],
    };
  });
};

//get maintenance statuses
const getStatuses = async (params, language = LANGUAGES.EN) => {
  const request = await getMaintenanceRequest(params);
  if (!request) {
    throw new AppError("getStatuses", "Request not found", "custom", 404);
  }
  const { isMaintenanceFree } = await getPropertyFeatureFromFlat(
    request.flatId
  );

  let response = [],
    data;
  const { status, createdAt } = (
    await getRequestStatuses({ maintenanceId: params.id }, 1)
  )[0];

  switch (status) {
    case MAINTENANCE_STATUSES.PENDING.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.CANCELLED.key,
          status: MAINTENANCE_STATUSES.CANCELLED[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.COMPLETED.key,
          status: MAINTENANCE_STATUSES.COMPLETED[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.ASSIGNED.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.RE_ASSIGNED.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.PROCESSING.key:
      if (isMaintenanceFree) {
        data = [
          {
            key: MAINTENANCE_STATUSES.ON_HOLD.key,
            status: MAINTENANCE_STATUSES.ON_HOLD[`status_${language}`],
          },
          {
            key: MAINTENANCE_STATUSES.COMPLETED.key,
            status: MAINTENANCE_STATUSES.COMPLETED[`status_${language}`],
          },
        ];
      } else {
        data = [
          {
            key: MAINTENANCE_STATUSES.ON_HOLD.key,
            status: MAINTENANCE_STATUSES.ON_HOLD[`status_${language}`],
          },
          {
            key: MAINTENANCE_STATUSES.COMPLETED.key,
            status: MAINTENANCE_STATUSES.COMPLETED[`status_${language}`],
          },
          {
            key: MAINTENANCE_STATUSES.QUOTATION_NEEDED.key,
            status: MAINTENANCE_STATUSES.QUOTATION_NEEDED[`status_${language}`],
          },
        ];
      }
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.ON_HOLD.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.REJECTED.key,
          status: MAINTENANCE_STATUSES.REJECTED[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.COMPLETED.key:
      if (moment().diff(moment(createdAt), "hours") >= 48) {
        break;
      }
      data = [
        {
          key: MAINTENANCE_STATUSES.RE_OPEN.key,
          status: MAINTENANCE_STATUSES.RE_OPEN[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.QUOTATION_NEEDED.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.QUOTATION_SENT.key,
          status: MAINTENANCE_STATUSES.QUOTATION_SENT[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.QUOTATION_SENT.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.QUOTATION_APPROVED.key,
          status: MAINTENANCE_STATUSES.QUOTATION_APPROVED[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.QUOTATION_REJECTED.key,
          status: MAINTENANCE_STATUSES.QUOTATION_REJECTED[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.QUOTATION_APPROVED.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.REJECTED.key,
          status: MAINTENANCE_STATUSES.REJECTED[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.QUOTATION_REJECTED.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.REJECTED.key,
          status: MAINTENANCE_STATUSES.REJECTED[`status_${language}`],
        },
      ];
      response.push(...data);
      break;
    case MAINTENANCE_STATUSES.RE_OPEN.key:
      data = [
        {
          key: MAINTENANCE_STATUSES.PROCESSING.key,
          status: MAINTENANCE_STATUSES.PROCESSING[`status_${language}`],
        },
        {
          key: MAINTENANCE_STATUSES.COMPLETED.key,
          status: MAINTENANCE_STATUSES.COMPLETED[`status_${language}`],
        },
      ];
      response.push(...data);
      break;

    default:
      logger.warn("No case matched for maintenance statuses");
      break;
  }
  return response;
};

//create new maintenance request
const createRequest = async (
  data,
  user,
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) => {
  if (!data.type || !Object.keys(MAINTENANCE_TYPES).includes(data.type)) {
    throw new AppError("createRequest", "Invalid Maintenance Type");
  }

  if (!data.description) {
    throw new AppError("createRequest", "Please add a description");
  }

  if (!data.categoryId) {
    throw new AppError("createRequest", "Please add category Id");
  }

  const category = await getCategoryFromFlat(
    { flatId: data.flatId, categoryId: data.categoryId },
    language
  );

  if (!category) {
    throw new AppError("createRequest", "Category not found");
  }

  if (data.time) {
    if (moment(data.time) < moment()) {
      throw new AppError("createRequest", "Selected time has passed");
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

  const newRequest = await MaintenanceRequest.create(data);
  if (newRequest) {
    await MaintenanceStatus.create({
      maintenanceId: newRequest.id,
      status: MAINTENANCE_STATUSES.PENDING.key,
      comment: data?.comment,
      files: data?.files,
    });
  }
  return newRequest;
};

//update a maintenance request
const updateRequest = async (data, language = LANGUAGES.EN) => {
  if (!data.requestId) {
    throw new AppError("updateRequest", "Request ID is required");
  }
  const params = {
    id: data.requestId,
    userId: data.userId,
  };

  const findRequest = await MaintenanceRequest.findOne({
    where: params,
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });

  if (data.categoryId) {
    const category = await getCategoryFromFlat(
      { flatId: findRequest.flatId, categoryId: data.categoryId },
      language
    );

    if (!category) {
      throw new AppError("createRequest", "Category not found");
    }
  }

  if (!findRequest) {
    throw new AppError("updateRequest", "Maintenance request not found");
  }
  if (
    findRequest.statusDetails[0].status == MAINTENANCE_STATUSES.CANCELLED.key ||
    findRequest.statusDetails[0].status == MAINTENANCE_STATUSES.COMPLETED.key
  ) {
    return "Maintenance request already completed";
  } else if (
    findRequest.statusDetails[0].status !== MAINTENANCE_STATUSES.PENDING.key
  ) {
    return "You cannot edit an ongoing request";
  }

  if (data.status) {
    data.status = data.status.toUpperCase();
    if (data.status !== MAINTENANCE_STATUSES.CANCELLED.key) {
      throw new AppError("updateRequest", "You can only cancel the request");
    }
  }
  if (data.time) {
    if (moment(data.time) < moment()) {
      throw new AppError("updateRequest", "Time has passed");
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
  delete data.requestId;
  delete data.userId;

  for (const key in data) {
    findRequest[key] = data[key];
  }
  await findRequest.save();
  if (data.status == MAINTENANCE_STATUSES.CANCELLED.key) {
    await MaintenanceStatus.create({
      status: MAINTENANCE_STATUSES.CANCELLED.key,
      comment: data?.comment,
      files: data?.files,
      maintenanceId: findRequest.id,
    });
  }
  // findRequest.type = MAINTENANCE_TYPES[findRequest.type][`type_${language}`];
  findRequest.status =
    MAINTENANCE_STATUSES[findRequest.status][`status_${language}`];
  return findRequest;
};

//get a specific maintenance request
const getRequest = async (
  params,
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) => {
  let findRequest = await getRequestWithFlatBuildingAndStaff(params);
  if (!findRequest) {
    throw new AppError("getRequest", "Maintenance request not found");
  }
  findRequest = findRequest.get({ plain: true });
  findRequest.type = findRequest["category"][`name_${language}`]; //to be removed after latest build release
  findRequest.statusDetails = await MaintenanceStatus.findAll({
    where: {
      maintenanceId: findRequest.id,
    },
    order: [["createdAt", "DESC"]],
  });

  if (findRequest.preferredTime?.start) {
    findRequest.preferredTime.start = moment(findRequest.preferredTime.start)
      .tz(timezone)
      .format();
  }
  if (findRequest.preferredTime?.end) {
    findRequest.preferredTime.end = moment(findRequest.preferredTime.end)
      .tz(timezone)
      .format();
  }

  findRequest.statusDetails.map((detail) => {
    detail.status = MAINTENANCE_STATUSES[detail.status][`status_${language}`];
  });
  return findRequest;
};

//get all maintenance request of a user
const getAllRequests = async (
  params,
  query,
  { limit, offset },
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) => {
  if (
    query.status &&
    !Object.keys(MAINTENANCE_STATUSES).includes(query.status)
  ) {
    throw new AppError("getAllRequests", "Invalid status");
  }
  //TODO: Have to remove the category type keyword at the time of production
  const requestQuery = `
  SELECT mr.id, mr."requestId", mr."isBuilding", mr."isUrgent", mr."description", mr.files, mr."categoryId",
  mr.rating, mr."userId", mr."staffId", mr."staffTimeSlot", mr."flatId", mr."generatedBy", mr."createdAt", 
  ms.id as "statusDetails.id", ms."maintenanceId" as "statusDetails.maintenanceId", ms.status as "statusDetails.status", 
  ms.comment as "statusDetails.comment", ms.files as "statusDetails.files", ms."metaData" as "statusDetails.metaData", ms."createdAt" as "statusDetails.createdAt",
  s.id AS "staff.id", s.name AS "staff.name", s.email AS "staff.email", s."countryCode" AS "staff.countryCode", s."mobileNumber" AS "staff.mobileNumber", s."profilePicture" AS "staff.profilePicture",
  mc.name_${language} as "type", mc.name_${language} as "category.name", mc.image as "category.image", mc.id as "category.id",
  COUNT (*) OVER () as count
  FROM maintenance_requests mr 
  JOIN (
      select distinct on("maintenanceId") * from maintenance_statuses 
      where "deletedAt" is null 
      order by "maintenanceId", "createdAt" desc
  ) ms on ms."maintenanceId" = mr.id ${
    query.status ? `and ms.status ='${query.status}'` : ""
  }
  JOIN maintenance_categories as mc ON mr."categoryId" = mc.id 
  JOIN users u ON (mr."userId" = u.id AND u."deletedAt" IS NULL)
  LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND (s."deletedAt" IS NULL) 
  WHERE u.id = :userId and mr."deletedAt" IS NULL and mr."flatId" = :flatId and mr."userId" = :userId
  ${query.type ? `and mr.type = '${query.type}'` : ""}
  ${query.categoryId ? `and mc.id = '${query.categoryId}'` : ""}
  ${
    query.requestId
      ? `and cast(mr."requestId" as text) like '%${query.requestId}%'`
      : ""
  }
  ${query.isUrgent ? `and mr."isUrgent" is ${query.isUrgent}` : ""}
  ${query.isBuilding ? `and mr."isBuilding" is ${query.isBuilding}` : ""}
  ${query.generatedBy ? `and mr."generatedBy" = '${query.generatedBy}'` : ""}
  ORDER BY mr."createdAt" DESC LIMIT :limit OFFSET :offset`;
  const requests = await db.sequelize.query(requestQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      userId: params.userId,
      flatId: params.flatId,
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
    request.statusDetails.status =
      MAINTENANCE_STATUSES[request.statusDetails.status][`status_${language}`];
    !request.staffId && (request.staff = null);
    delete request.count;
    delete request.status; //TODO: remove this line once migrated with removing status
  });
  return { count, rows: requests };
};

async function getRequestWithFlatBuildingAndStaff(params) {
  return await MaintenanceRequest.findOne({
    where: params,
    include: [
      {
        model: User,
        as: "user",
        required: false,
        attributes: ["id", "name", "profilePicture"],
      },
      {
        model: MaintenanceCategory,
        as: "category",
        paranoid: false,
        attributes: ["id", "name_en", "name_ar"],
      },
      {
        model: MaintenanceCategory,
        as: "subCategory",
        paranoid: false,
        attributes: ["id", "name_en", "name_ar"],
      },
      {
        model: Flat,
        as: "flat",
        required: true,
        attributes: ["id", "name_en", "name_ar"],
        include: {
          model: Building,
          as: "building",
          attributes: ["id", "name_en", "name_ar"],
        },
      },
      {
        model: Staff,
        as: "staff",
        required: false,
        attributes: [
          "id",
          "name",
          "email",
          "countryCode",
          "mobileNumber",
          "profilePicture",
          "department",
        ],
      },
    ],
  });
}

async function getRequestWithChargeAndPayment(params) {
  return await MaintenanceRequest.findOne({
    where: params,
    include: [
      {
        model: Charge,
        as: "charge",
        required: false,
        include: {
          model: Payment,
          as: "payments",
          order: [["createdAt", "DESC"]],
          limit: 1,
        },
      },
    ],
  });
}

async function getMaintenanceRequest(params) {
  return await MaintenanceRequest.findOne({ where: params });
}

async function getMaintenanceRequestsCount(params, { startDate, endDate }) {
  let buildingIds = [];
  if (params.buildingId) {
    buildingIds.push(params.buildingId);
  } else {
    (await getBuildings({ propertyId: params.propertyId })).map((building) => {
      buildingIds.push(building.id);
    });
  }
  const [
    total,
    cancelled,
    pending,
    assigned,
    processing,
    completed,
    reOpen,
    onHold,
    pendingTillDate,
    processingTillDate,
    onHoldTillDate,
  ] = await Promise.all([
    //total raised
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and mr."createdAt" >= :startDate and mr."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //cancelled
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          buildingIds,
          status: MAINTENANCE_STATUSES.CANCELLED.key,
          startDate,
          endDate,
        },
      }
    ),
    //pending
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.PENDING.key,
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //assigned
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status in (:status))
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: new Array(
            MAINTENANCE_STATUSES.ASSIGNED.key,
            MAINTENANCE_STATUSES.RE_ASSIGNED.key
          ),
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //processing
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.PROCESSING.key,
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //completed
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.COMPLETED.key,
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //re-opened
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.RE_OPEN.key,
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //on-hold
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null and ms."createdAt" >= :startDate and ms."createdAt" <= :endDate`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.ON_HOLD.key,
          buildingIds,
          startDate,
          endDate,
        },
      }
    ),
    //pending till date
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.PENDING.key,
          buildingIds,
        },
      }
    ),
    //processing till date
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.PROCESSING.key,
          buildingIds,
        },
      }
    ),
    //on hold till date
    db.sequelize.query(
      `
      select count(mr.*) from maintenance_requests mr join 
      (
        select distinct on("maintenanceId") * from maintenance_statuses 
        where "deletedAt" is null 
        order by "maintenanceId", "createdAt" desc
      ) ms
      on ms."maintenanceId" = mr.id and (ms.status = :status)
      join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds))
      where mr."deletedAt" is null`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          status: MAINTENANCE_STATUSES.ON_HOLD.key,
          buildingIds,
        },
      }
    ),
  ]);

  return {
    total: total[0].count,
    cancelled: cancelled[0].count,
    pending: pending[0].count,
    assigned: assigned[0].count,
    processing: processing[0].count,
    completed: completed[0].count,
    reOpen: reOpen[0].count,
    onHold: onHold[0].count,
    pendingTillDate: pendingTillDate[0].count,
    processingTillDate: processingTillDate[0].count,
    onHoldTillDate: onHoldTillDate[0].count,
  };
}

async function updateMaintenanceStatus(data, params) {
  return await MaintenanceStatus.update(data, { where: params });
}

async function getRequestStatuses(
  params,
  limit,
  order = ["createdAt", "DESC"]
) {
  return await MaintenanceStatus.findAll({
    where: params,
    order: [order],
    limit,
  });
}

async function getRequestCountForAllStatuses(
  params,
  timezone = TIMEZONES.INDIA
) {
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
  }
  if (params.type && !Object.keys(MAINTENANCE_TYPES).includes(params.type)) {
    throw new AppError(
      "getRequestCountForAllStatuses",
      "Invalid Maintenance type",
      "custom",
      412
    );
  }
  const responseObj = {};
  await Promise.all(
    Object.keys(MAINTENANCE_STATUSES).map(async (status) => {
      let query;
      if (params.startDate && params.endDate) {
        query = `
        select count(mr.*) from maintenance_requests mr join 
        (
          select distinct on("maintenanceId") * from maintenance_statuses 
          where "deletedAt" is null 
          order by "maintenanceId", "createdAt" desc
        ) ms
        on ms."maintenanceId" = mr.id and (ms.status = :status)
        join maintenance_categories mc on mc.id = mr."categoryId"
        join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds) ${
          params.flatId ? `AND f.id = '${params.flatId}'` : ""
        })
        where mr."deletedAt" is null ${
          params.categoryId ? `and mc.id = '${params.categoryId}'` : ""
        } ${params.isUrgent ? `and mr."isUrgent" is ${params.isUrgent}` : ""} ${
          params.generatedBy
            ? `and mr."generatedBy" = '${params.generatedBy}'`
            : ""
        } and mr."createdAt" >= :startDate and mr."createdAt" <= :endDate`;
      } else {
        query = `
        select count(mr.*) from maintenance_requests mr join 
        (
          select distinct on("maintenanceId") * from maintenance_statuses 
          where "deletedAt" is null 
          order by "maintenanceId", "createdAt" desc
        ) ms
        on ms."maintenanceId" = mr.id and (ms.status = :status)
        join maintenance_categories mc on mc.id = mr."categoryId"
        join flats f on f.id = mr."flatId" AND (f."deletedAt" is null AND f."buildingId" in (:buildingIds) ${
          params.flatId ? `AND f.id = '${params.flatId}'` : ""
        })
        where mr."deletedAt" is null ${
          params.categoryId ? `and mc.id = '${params.categoryId}'` : ""
        } ${params.isUrgent ? `and mr."isUrgent" is ${params.isUrgent}` : ""} ${
          params.generatedBy
            ? `and mr."generatedBy" = '${params.generatedBy}'`
            : ""
        }`;
      }

      const statusCount = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          buildingIds: params.buildingId,
          status,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      });

      responseObj[status] = +statusCount[0]?.count;
    })
  );
  responseObj["ALL"] = Object.values(responseObj).reduce(
    (accumulator, count) => accumulator + count
  );
  return responseObj;
}

async function getRequestCountForAllStatusesWithLabel(
  params,
  timezone = TIMEZONES.INDIA
) {
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
  }
  if (params.type && !Object.keys(MAINTENANCE_TYPES).includes(params.type)) {
    throw new AppError(
      "getRequestCountForAllStatuses",
      "Invalid Maintenance type",
      "custom",
      412
    );
  }
  const allCount = {};
  const responseList = [];
  await Promise.all(
    Object.keys(MAINTENANCE_STATUSES).map(async (status) => {
      let query;
      if (params.startDate && params.endDate) {
        query = `
        select count(mr.*)::INTEGER from maintenance_requests mr join 
        (
          select distinct on("maintenanceId") * from maintenance_statuses 
          where "deletedAt" is null 
          order by "maintenanceId", "createdAt" desc
        ) ms
        on ms."maintenanceId" = mr.id and (ms.status = :status)
        join maintenance_categories mc on mc.id = mr."categoryId"
        join flats f on f.id = mr."flatId" AND (f."deletedAt" is null ${
          params.flatId ? `AND f.id = '${params.flatId}'` : ""
        })
        LEFT OUTER JOIN users u ON mr."userId" = u.id AND (u."deletedAt" IS NULL) 
        LEFT OUTER JOIN buildings b ON f."buildingId" = b.id AND (b."deletedAt" IS NULL) 
        LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND (s."deletedAt" IS NULL)
        where mr."deletedAt" is null AND  ${
          params.buildingId && params.buildingId.length
            ? `f."buildingId" IN (:buildingIds)`
            : `0=1`
        }
         ${
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

         ${params.categoryId ? `and mc.id = '${params.categoryId}'` : ""} ${
          params.isUrgent ? `and mr."isUrgent" is ${params.isUrgent}` : ""
        } ${
          params.generatedBy
            ? `and mr."generatedBy" = '${params.generatedBy}'`
            : ""
        } and mr."createdAt" >= :startDate and mr."createdAt" <= :endDate`;
      } else {
        query = `
        select count(mr.*)::INTEGER from maintenance_requests mr join 
        (
          select distinct on("maintenanceId") * from maintenance_statuses 
          where "deletedAt" is null 
          order by "maintenanceId", "createdAt" desc
        ) ms
        on ms."maintenanceId" = mr.id and (ms.status = :status)
        join maintenance_categories mc on mc.id = mr."categoryId"
        join flats f on f.id = mr."flatId" AND (f."deletedAt" is null ${
          params.flatId ? `AND f.id = '${params.flatId}'` : ""
        })
        LEFT OUTER JOIN users u ON mr."userId" = u.id AND (u."deletedAt" IS NULL) 
        LEFT OUTER JOIN buildings b ON f."buildingId" = b.id AND (b."deletedAt" IS NULL) 
        LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND (s."deletedAt" IS NULL)
        where mr."deletedAt" is null AND ${
          params.buildingId && params.buildingId.length
            ? `f."buildingId" IN (:buildingIds)`
            : `0=1`
        }
           ${
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
       
         ${params.categoryId ? `and mc.id = '${params.categoryId}'` : ""} ${
          params.isUrgent ? `and mr."isUrgent" is ${params.isUrgent}` : ""
        } ${
          params.generatedBy
            ? `and mr."generatedBy" = '${params.generatedBy}'`
            : ""
        }`;
      }

      const statusCount = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          buildingIds: params.buildingId,
          status,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      });
      const responseObj = {
        key: status,
        label: MAINTENANCE_STATUSES[status].status_en,
        count: statusCount[0]?.count,
      };
      responseList.push(responseObj);
      allCount[status] = +statusCount[0]?.count;
    })
  );
  const allRequestCount = Object.values(allCount).reduce(
    (accumulator, count) => accumulator + count
  );

  const responseObj = {
    key: null,
    label: "ALL",
    count: +allRequestCount,
  };
  responseList.unshift(responseObj);

  const customOrder = [
    "ALL",
    "Open",
    "Assigned",
    "In-Process",
    "Completed",
    "Cancelled",
    "On Hold",
    "Re-open",
    "Re-Assigned",
    "Need Quotation",
    "Quotation Sent",
    "Quotation Approved",
    "Quotation Rejected",
    "Rejected",
  ];

  const sortedData = responseList.sort((a, b) => {
    const indexA = customOrder.indexOf(a.label);
    const indexB = customOrder.indexOf(b.label);

    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });

  return sortedData;
}

async function createMultipleRequests(data, timezone = TIMEZONES.INDIA) {
  const reference = "createMultipleRequests";
  if (!Array.isArray(data.requests) || !data.requests.length) {
    throw new AppError(reference, "Enter valid requests", "custom", 422);
  }
  const responseArr = [];
  const flat = await getFlat({ id: data.flatId });
  for (let request of data.requests) {
    const transaction = await db.sequelize.transaction();
    try {
      if (!request.categoryId) {
        throw new AppError("createRequestAdmin", "Please add category Id");
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
      const category = await getCategoryFromFlat({
        flatId: data.flatId,
        categoryId: request.categoryId,
      });

      if (!category) {
        throw new AppError("createRequest", "Category not found");
      }

      request.flatId = data.flatId;
      request.generatedBy = data.generatedBy;
      request.userId = data.userId;
      request.subCategoryId = request.categoryId;

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

      responseArr.push({
        success: true,
        feIdentifier: request.feIdentifier,
        id: newRequest.id,
        requestId: newRequest.requestId,
        type: newRequest.type,
        preferredTime: newRequest.preferredTime,
      });

      await transaction.commit();
      //send email to user
      const emailObj = {
        ticketNo: newRequest.requestId,
        residentName: data.userName,
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
      requestCreatedForUser(data.userEmail, emailObj);

      //send email to admin
      Promise.all([
        getAdminForFlat(data.flatId),
        getBuilding({ id: flat.buildingId }),
      ]).then(([admin, building]) => {
        requestCreatedForAdmin(admin.email, {
          ...emailObj,
          buildingName: building.name,
          adminName: admin.name,
        });
      });

      eventEmitter.emit("admin_level_notification", {
        flatId: data.flatId,
        actionType: ADMIN_ACTION_TYPES.NEW_REQUEST.key,
        sourceType: ADMIN_SOURCE_TYPES.SERVICES,
        sourceId: newRequest.id,
        generatedBy: data.userId,
      });
    } catch (error) {
      logger.warn(error.message);
      await transaction.rollback();
      responseArr.push({
        success: false,
        feIdentifier: request.feIdentifier,
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
}

async function requestCancelReasons(language = LANGUAGES.EN) {
  return Object.keys(REQUEST_CANCEL_REASONS).map((key) => {
    return {
      key,
      reason: REQUEST_CANCEL_REASONS[key][`reason_${language}`],
    };
  });
}

async function submitFeedback(data, requestId) {
  const reference = "submitFeedback";
  const rating = data.rating;
  const feedback = data.feedback;

  const params = {
    id: requestId,
    flatId: data.flatId,
    userId: data.userId,
  };

  if (!rating) {
    throw new AppError(reference, "Rating is required", "custom", 412);
  }

  if (rating < 1 || rating > 5) {
    throw new AppError(
      reference,
      "Rating should not be less than 1 and greater than 5",
      "custom",
      412
    );
  }

  if (!feedback) {
    throw new AppError(reference, "Feedback is required", "custom", 412);
  }
  const findRequest = await MaintenanceRequest.findOne({
    where: params,
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });
  if (!findRequest) {
    throw new AppError(
      reference,
      "Maintenance request not found",
      "custom",
      404
    );
  }
  if (
    findRequest.statusDetails[0].status !== MAINTENANCE_STATUSES.COMPLETED.key
  ) {
    throw new AppError(reference, "Request not completed yet", "custom", 425);
  }

  await findRequest.update({
    rating: rating,
    feedback: feedback,
  });
  return null;
}

async function getRequestCountForAllStatusesForUser(
  params,
  timezone = TIMEZONES.INDIA
) {
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
  }
  if (params.type && !Object.keys(MAINTENANCE_TYPES).includes(params.type)) {
    throw new AppError(
      "getRequestCountForAllStatuses",
      "Invalid Maintenance type",
      "custom",
      412
    );
  }
  const responseObj = {};
  await Promise.all(
    Object.keys(MAINTENANCE_STATUSES).map(async (status) => {
      let query;
      if (params.startDate && params.endDate) {
        query = `
        select count(distinct(mr.id)) from maintenance_requests mr join 
        (
          select distinct on("maintenanceId") * from maintenance_statuses 
          where "deletedAt" is null 
          order by "maintenanceId", "createdAt" desc
        ) ms
        on ms."maintenanceId" = mr.id and (ms.status = :status)
        join maintenance_categories mc on mc.id = mr."categoryId"
        join flats f on f.id = mr."flatId" AND (f."deletedAt" is null)
         join users u on (
     u."deletedAt" is null 
    AND u."flatId" = f.id
  ) 
where 
  mr."deletedAt" is null and mr."userId" = :userId
  and mr."flatId" = :flatId ${
    params.categoryId ? `and mc.id = '${params.categoryId}'` : ""
  }  and mr."createdAt" >= :startDate and mr."createdAt" <= :endDate`;
      } else {
        query = `
       select count(distinct(mr.id)) from maintenance_requests mr join 
        (
          select distinct on("maintenanceId") * from maintenance_statuses 
          where "deletedAt" is null 
          order by "maintenanceId", "createdAt" desc
        ) ms
        on ms."maintenanceId" = mr.id and (ms.status = :status)
        join maintenance_categories mc on mc.id = mr."categoryId"
        join flats f on f.id = mr."flatId" AND (f."deletedAt" is null)
         join users u on (
     u."deletedAt" is null 
    AND u."flatId" = f.id
  ) 
where 
  mr."deletedAt" is null and mr."userId" = :userId
  and mr."flatId" = :flatId ${
    params.categoryId ? `and mc.id = '${params.categoryId}'` : ""
  }`;
      }

      const statusCount = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          flatId: params.flatId,
          userId: params.userId,
          status,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      });

      responseObj[status] = +statusCount[0]?.count;
    })
  );
  responseObj["ALL"] = Object.values(responseObj).reduce(
    (accumulator, count) => accumulator + count
  );
  return responseObj;
}
async function getTotalRequestCount(requestParams) {
  return await MaintenanceRequest.findOne({
    where: requestParams,
    attributes: [
      [
        db.sequelize.fn("count", db.sequelize.col("MaintenanceRequest.id")),
        "totalRequests",
      ],
    ],
    raw: true,
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
}

module.exports = {
  createRequest,
  getTypes,
  updateRequest,
  getRequest,
  getAllRequests,
  getStatuses,
  getRequestWithFlatBuildingAndStaff,
  getMaintenanceRequest,
  getRequestWithChargeAndPayment,
  getMaintenanceRequestsCount,
  updateMaintenanceStatus,
  getStatusesList,
  getRequestCountForAllStatuses,
  createMultipleRequests,
  requestCancelReasons,
  submitFeedback,
  getRequestCountForAllStatusesForUser,
  getRequestCountForAllStatusesWithLabel,
  getTotalRequestCount,
};
