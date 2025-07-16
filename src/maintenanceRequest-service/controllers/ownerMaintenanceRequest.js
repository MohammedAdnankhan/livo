const {
  LANGUAGES,
  MAINTENANCE_STATUSES,
  TIMEZONES,
  MAINTENANCE_REQUESTED_BY,
} = require("../../config/constants");
const db = require("../../database");
const MaintenanceRequest = require("../../maintenanceRequest-service/models/MaintenanceRequest");
const { AppError } = require("../../utils/errorHandler");
const { getCategoryFromFlat } = require("./maintenanceCategory");
const logger = require("../../utils/logger");
const { getUser } = require("../../user-service/controllers/user");
const moment = require("moment-timezone");
const MaintenanceStatus = require("../../maintenanceRequest-service/models/MaintenanceStatus");
const MaintenanceCategory = require("../models/MaintenanceCategory");

const getMaintenanceRequestsForOwner = async (
  params,
  { offset, limit },
  language = LANGUAGES.EN,
  timezone
) => {
  const {
    search = null,
    status = null,
    isUrgent = null,
    generatedBy,
    isBuilding,
    flatId = null,
    category = null,
    buildingId = null,
    startDate = null,
    endDate = null,
    buildings,
  } = params;
  const requestQuery = `
  SELECT mr.id, mr."requestId", mr."isBuilding", mr."isUrgent", mr."description", mr.files, mr."categoryId",
  mr.rating, mr."userId", mr."staffId", mr."staffTimeSlot", mr."flatId", mr."generatedBy", mr."createdAt", 
  ms.id as "statusDetails.id", ms."maintenanceId" as "statusDetails.maintenanceId", ms.status as "statusDetails.status", 
  ms.comment as "statusDetails.comment", ms.files as "statusDetails.files", ms."metaData" as "statusDetails.metaData", ms."createdAt" as "statusDetails.createdAt",
  s.id AS "staff.id", s.name AS "staff.name", s.email AS "staff.email", s."countryCode" AS "staff.countryCode", s."mobileNumber" AS "staff.mobileNumber", s."profilePicture" AS "staff.profilePicture",
  f.id AS "flat.id",f.name_${language} AS "flat.name",
  mc.name_${language} as "type", mc.name_${language} as "category.name", mc.image as "category.image", mc.id as "category.id",
  COUNT (*) OVER () as count
  FROM maintenance_requests mr 
  JOIN (
      select distinct on("maintenanceId") * from maintenance_statuses 
      where "deletedAt" is null 
      order by "maintenanceId", "createdAt" desc
  ) ms on ms."maintenanceId" = mr.id ${
    status ? `and ms.status = '${status}'` : ""
  }
  JOIN maintenance_categories as mc ON mr."categoryId" = mc.id 
  LEFT OUTER JOIN staffs s ON mr."staffId" = s.id AND (s."deletedAt" IS NULL) 
  JOIN flats f ON f."id" = mr."flatId" and (f."deletedAt" IS NULL)
  JOIN buildings b ON (f."buildingId" =  b.id and b."deletedAt" IS NULL ${
    buildingId ? `and b.id = '${buildingId}'` : ""
  })
  WHERE mr."deletedAt" IS NULL AND mr."flatId" in (:flats) ${
    startDate && endDate
      ? `AND mr."createdAt" between :startDate and :endDate`
      : ``
  }
  ${
    search
      ? `and (cast(mr."requestId" as text) ilike '%${search}%' 
      or mr.type ilike '%${search}%'
      or mr.description ilike '%${search}%'
      or f.name_${language} ilike '%${search}%'
      or s.name ilike '%${search}%'
      or cast(mr."createdAt" as text) ilike '%${search}%' 
      )`
      : ""
  }
  ${category ? `and mc.name_${language} = '${category}'` : ""}
  ${isUrgent ? `and mr."isUrgent" is ${isUrgent}` : ""}
  ${isBuilding ? `and mr."isBuilding" is ${isBuilding}` : ""}
  ${generatedBy ? `and mr."generatedBy" = '${generatedBy}'` : ""}
  ORDER BY mr."createdAt" DESC LIMIT :limit OFFSET :offset`;

  const requests = await db.sequelize.query(requestQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      flats: flatId
        ? [flatId]
        : buildings.flatMap(({ flats }) => flats.map(({ id }) => id)),
      limit,
      offset,
      startDate,
      endDate,
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
  });
  return { count, rows: requests };
};

const createMultipleMaintenanceForOwner = async (requests) => {
  const reference = "createMultipleMaintenanceForOwner";

  const requestsResponse = await Promise.all(
    requests.map(async (request) => {
      const transaction = await db.sequelize.transaction();
      try {
        const [category, user] = await Promise.all([
          getCategoryFromFlat({
            flatId: request.flatId,
            categoryId: request.categoryId,
          }),
          getUser({ flatId: request.flatId }),
        ]);
        if (!category) {
          throw new AppError(reference, "Category not found", "custom", 404);
        }
        request.generatedBy = MAINTENANCE_REQUESTED_BY.OWNER;
        if (user) {
          request.userId = user.id;
        }
        const newRequest = await MaintenanceRequest.create(request, {
          transaction,
        });
        await MaintenanceStatus.create(
          {
            maintenanceId: newRequest.id,
            status: MAINTENANCE_STATUSES.PENDING.key,
            comment: request?.comment,
            files: request?.files,
          },
          { transaction }
        );
        await transaction.commit();

        return {
          success: true,
          id: newRequest.id,
        };
      } catch (error) {
        await transaction.rollback();
        logger.warn(error.message);

        return {
          success: false,
          column: error?.errors?.[0]?.column
            ? error.errors[0].column
            : "Anonymous",
          message: error?.errors?.[0]?.message
            ? error.errors[0].message
            : error.message,
        };
      }
    })
  );

  return requestsResponse;
};

const getMaintenanceCategoriesForOwner = async (
  { flatId, ownerBuildings },
  language = LANGUAGES.EN
) => {
  let categoriesQuery;
  if (flatId) {
    categoriesQuery = `
      SELECT mc.id, mc.name_${language} AS name, mc.image FROM maintenance_categories mc
      JOIN properties p ON (p.id = mc."propertyId" AND p."deletedAt" IS NULL)
      JOIN buildings b ON (b."propertyId" = p.id AND b."deletedAt" IS NULL)
      JOIN flats f ON (f."buildingId" = b.id AND f.id IN (:flatIds))
      WHERE mc."isVisible" IS true AND mc."deletedAt" IS NULL ORDER BY mc.name_${language} ASC`;
  } else {
    categoriesQuery = `
      SELECT DISTINCT(mc.name_${language}) AS name, image FROM maintenance_categories mc
      JOIN properties p ON (p.id = mc."propertyId" AND p."deletedAt" IS NULL)
      JOIN buildings b ON (b."propertyId" = p.id AND b."deletedAt" IS NULL)
      JOIN flats f ON (f."buildingId" = b.id AND f.id IN (:flatIds))
      WHERE mc."isVisible" IS true AND mc."deletedAt" IS NULL ORDER BY mc.name_${language} ASC`;
  }

  const flatIds = flatId
    ? [flatId]
    : ownerBuildings.flatMap(({ flats }) => flats.map(({ id }) => id));

  return await db.sequelize.query(categoriesQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    replacements: {
      flatIds,
    },
  });
};

const cancelRequest = async ({ requestId, flatId, comment }) => {
  const reference = "cancelRequest";
  const params = {
    id: requestId,
    flatId,
    // generatedBy: MAINTENANCE_REQUESTED_BY.OWNER,
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
  if (!findRequest) {
    throw new AppError(
      reference,
      "Maintenance request not found",
      "custom",
      404
    );
  }

  if (findRequest.generatedBy != MAINTENANCE_REQUESTED_BY.OWNER) {
    throw new AppError(
      reference,
      "You can only cancel requests created by yourself",
      "custom",
      412
    );
  }

  if (
    findRequest.statusDetails[0].status == MAINTENANCE_STATUSES.CANCELLED.key ||
    findRequest.statusDetails[0].status == MAINTENANCE_STATUSES.COMPLETED.key
  ) {
    throw new AppError(
      reference,
      "Maintenance request already completed",
      "custom",
      412
    );
  } else if (
    findRequest.statusDetails[0].status !== MAINTENANCE_STATUSES.PENDING.key
  ) {
    throw new AppError(
      reference,
      "You cannot cancel an ongoing request",
      "custom",
      412
    );
  }

  await MaintenanceStatus.create({
    status: MAINTENANCE_STATUSES.CANCELLED.key,
    comment,
    maintenanceId: findRequest.id,
  });

  return null;
};

const getRequestForOwner = async (
  { id, flatId },
  timezone = TIMEZONES.INDIA,
  language = LANGUAGES.EN
) => {
  const reference = "getRequestForOwner";
  const params = {
    id,
    flatId,
  };
  const findRequest = await MaintenanceRequest.findOne({
    where: params,
    attributes: {
      exclude: ["subCategoryId", "status", "updatedAt", "deletedAt"],
    },
    include: [
      {
        model: MaintenanceStatus,
        as: "statusDetails",
        attributes: ["status", "comment", "files", "createdAt"],
        order: [["createdAt", "DESC"]],
        separate: true,
        required: true,
      },
      {
        model: MaintenanceCategory,
        as: "category",
        paranoid: false,
        attributes: ["id", [`name_${language}`, "name"]],
      },
    ],
  });
  if (!findRequest) {
    throw new AppError(
      reference,
      "Maintenance request not found",
      "custom",
      404
    );
  }

  findRequest.statusDetails.forEach((detail) => {
    detail.setDataValue(
      "status",
      MAINTENANCE_STATUSES[detail.status][`status_${language}`]
    );
    detail.setDataValue(
      "createdAt",
      moment(detail.createdAt).tz(timezone).format()
    );
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

  return findRequest;
};

const updateRequest = async (data) => {
  const reference = "updateRequest";
  const params = {
    id: data.requestId,
    flatId: data.flatId,
    // generatedBy: MAINTENANCE_REQUESTED_BY.OWNER,
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

  if (!findRequest) {
    throw new AppError(
      reference,
      "Maintenance request not found",
      "custom",
      404
    );
  }

  if (findRequest.generatedBy != MAINTENANCE_REQUESTED_BY.OWNER) {
    throw new AppError(
      reference,
      "You can only update requests created by yourself",
      "custom",
      412
    );
  }

  if (
    findRequest.statusDetails[0].status == MAINTENANCE_STATUSES.CANCELLED.key ||
    findRequest.statusDetails[0].status == MAINTENANCE_STATUSES.COMPLETED.key
  ) {
    throw new AppError(
      "updateRequest",
      "Maintenance request already completed",
      "custom",
      412
    );
  } else if (
    findRequest.statusDetails[0].status !== MAINTENANCE_STATUSES.PENDING.key
  ) {
    throw new AppError(
      "updateRequest",
      "You cannot edit an ongoing request",
      "custom",
      412
    );
  }

  if (data.categoryId) {
    const category = await getCategoryFromFlat({
      flatId: findRequest.flatId,
      categoryId: data.categoryId,
    });

    if (!category) {
      throw new AppError("updateRequest", "Category not found", "custom", 404);
    }
  }

  delete data.requestId;
  delete data.userId;

  for (const key in data) {
    findRequest[key] = data[key];
  }
  await findRequest.save();

  return null;
};

const requestFeedback = async (data) => {
  const reference = "requestFeedback";
  const params = {
    id: data.requestId,
    flatId: data.flatId,
    // generatedBy: MAINTENANCE_REQUESTED_BY.OWNER,
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
  if (!findRequest) {
    throw new AppError(
      "requestFeedback",
      "Maintenance request not found",
      "custom",
      404
    );
  }
  if (findRequest.generatedBy != MAINTENANCE_REQUESTED_BY.OWNER) {
    throw new AppError(
      reference,
      "Feedback can be given to requests raised by you only",
      "custom",
      412
    );
  }

  if (
    findRequest.statusDetails[0].status !== MAINTENANCE_STATUSES.COMPLETED.key
  ) {
    throw new AppError(reference, "Request not completed yet", "custom", 412);
  }

  await findRequest.update({
    rating: data.rating,
    feedback: data.feedback,
  });

  return null;
};

const getRequestStatusesCount = async (params, language = LANGUAGES.EN) => {
  const { flatId, buildingId, category, startDate, endDate, buildings } =
    params;
  const query = `
    SELECT COUNT(DISTINCT (mr.id))::INTEGER FROM maintenance_requests mr
    JOIN (
      SELECT DISTINCT ON("maintenanceId") * FROM maintenance_statuses WHERE "deletedAt" IS NULL
      ORDER BY "maintenanceId", "createdAt" DESC
    ) ms on (ms."maintenanceId" = mr.id AND ms.status = :status)
    JOIN flats f ON (f.id = mr."flatId" AND f."deletedAt" IS NULL)
    WHERE mr."deletedAt" IS NULL AND mr."flatId" IN (:flats) ${
      startDate && endDate
        ? `AND mr."createdAt" BETWEEN :startDate AND :endDate`
        : ""
    } ${buildingId ? `AND f."buildingId" = '${buildingId}'` : ""} ${
    category ? `and mc.name_${language} = '${category}'` : ""
  }`;

  const flats = flatId
    ? [flatId]
    : buildings.flatMap(({ flats }) => flats.map(({ id }) => id));

  const statusesCount = await Promise.all(
    Object.keys(MAINTENANCE_STATUSES).map(async (status) => {
      const [{ count }] = await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          flats,
          status,
          startDate,
          endDate,
        },
      });
      return { status: MAINTENANCE_STATUSES[status]["status_en"], count };
    })
  );
  const response = {};
  statusesCount.forEach(({ status, count }) => (response[status] = count));
  response["All"] = Object.values(response).reduce(
    (accumulator, currentValue) => accumulator + currentValue
  );
  return response;
};

module.exports = {
  getMaintenanceRequestsForOwner,
  createMultipleMaintenanceForOwner,
  getMaintenanceCategoriesForOwner,
  cancelRequest,
  getRequestForOwner,
  updateRequest,
  requestFeedback,
  getRequestStatusesCount,
};
