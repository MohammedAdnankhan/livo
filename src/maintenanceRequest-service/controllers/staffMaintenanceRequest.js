const { USER_TYPES } = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");

module.exports.getAssignedRequests = async (params, { offset, limit }) => {
  const reference = "getAssignedRequests";
  const countQuery = `SELECT COUNT(*)::INTEGER AS count
  FROM maintenance_requests mr
  INNER JOIN maintenance_categories mc ON (mc."id" = mr."categoryId"  ${
    params.categoryId ? `and mc.id = :categoryId` : ""
  })
  INNER JOIN flats f ON (f.id= mr."flatId" and f."deletedAt" is NULL)
  INNER JOIN buildings b ON (b.id =  f."buildingId" and b."deletedAt" is NULL)
  LEFT  JOIN users u ON (mr."userId" = u.id and u."deletedAt" is NULL)
  LEFT  JOIN owners o ON (o.id =  f."ownerId" and o."deletedAt" is NULL)
  INNER JOIN administrators ad ON (ad."propertyId" = b."propertyId" and ad."deletedAt" is NULL)
  WHERE mr."staffId" = :staffId and mr."deletedAt" is null
  ${
    params.startDate && params.endDate
      ? `AND mr."createdAt" between :startDate and :endDate`
      : ""
  }
  ${params.buildingId ? `AND b.id = :buildingId` : ""}
  ${params.flatId ? `AND f.id = :flatId` : ""}
`;

  const dataQuery = `
   SELECT mr.id, mr."createdAt", mr."generatedBy", mr."preferredTime",
  CASE
    WHEN u."id" IS NOT NULL THEN '${USER_TYPES.USER}'
    WHEN o."id" IS NOT NULL THEN '${USER_TYPES.OWNER}'
    ELSE '${USER_TYPES.ADMIN}'
  END AS "pointOfContact",
  CASE 
  	WHEN u."mobileNumber" IS NOT NULL THEN u."mobileNumber"
    WHEN o."mobileNumber" IS NOT NULL THEN o."mobileNumber"
    ELSE ad."mobileNumber"
 END AS "contactNumber",
  CASE 
  	WHEN u."name" IS NOT NULL THEN u."name"
    WHEN o."name" IS NOT NULL THEN o."name"
    ELSE ad."name"
 END AS "name",
  (SELECT ms."status" FROM maintenance_statuses ms WHERE ms."maintenanceId" = mr."id" AND ms."deletedAt" IS NULL ORDER BY ms."createdAt" DESC LIMIT 1) as "status",
  mr."isUrgent", mr."isBuilding", f."name_en" as "flatName",
  b."name_en" as "buildingName", mc."name_en" as "category",
  mr.files, mr."description"
  FROM maintenance_requests mr
  INNER JOIN maintenance_categories mc ON (mc."id" = mr."categoryId"  ${
    params.categoryId ? `and mc.id = :categoryId` : ""
  })
  INNER JOIN flats f ON (f.id= mr."flatId" and f."deletedAt" is NULL)
  INNER JOIN buildings b ON (b.id =  f."buildingId" and b."deletedAt" is NULL)
  LEFT  JOIN users u ON (mr."userId" = u.id and u."deletedAt" is NULL)
  LEFT  JOIN owners o ON (o.id =  f."ownerId" and o."deletedAt" is NULL)
  INNER JOIN administrators ad ON (ad."propertyId" = b."propertyId" and ad."deletedAt" is NULL)
  WHERE mr."staffId" = :staffId and mr."deletedAt" is null
  ${
    params.startDate && params.endDate
      ? `AND mr."createdAt" between :startDate and :endDate`
      : ""
  }
  ${params.buildingId ? `AND b.id = :buildingId` : ""}
  ${params.flatId ? `AND f.id = :flatId` : ""}
  ORDER BY mr."createdAt" desc LIMIT :limit OFFSET :offset
`;
  const [countRequest, assignedRequests] = await Promise.all([
    db.sequelize.query(countQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        flatId: params.flatId,
        buildingId: params.buildingId,
        startDate: params.startDate,
        categoryId: params.categoryId,
        endDate: params.endDate,
        staffId: params.staffId,
      },
    }),
    db.sequelize.query(dataQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        flatId: params.flatId,
        buildingId: params.buildingId,
        startDate: params.startDate,
        endDate: params.endDate,
        categoryId: params.categoryId,
        staffId: params.staffId,
        offset,
        limit,
      },
    }),
  ]);
  return { count: countRequest[0].count, rows: assignedRequests };
};

module.exports.getAssignRequestById = async (params) => {
  const reference = "getAssignRequestById";

  const dataQuery = `
   SELECT mr.id, mr."createdAt", mr."generatedBy", mr."preferredTime",
  (SELECT ms."status" FROM maintenance_statuses ms WHERE ms."maintenanceId" = mr."id" AND ms."deletedAt" IS NULL ORDER BY ms."createdAt" DESC LIMIT 1) as "status",
  mr."isUrgent", mr."isBuilding", f."name_en" as "flatName",
  b."name_en" as "buildingName", mc."name_en" as "category",
  mr.files, mr."description"
  FROM maintenance_requests mr
  INNER JOIN maintenance_categories mc ON (mc."id" = mr."categoryId")
  INNER JOIN flats f ON (f.id= mr."flatId" and f."deletedAt" is NULL)
  INNER JOIN buildings b ON (b.id =  f."buildingId" and b."deletedAt" is NULL)
  WHERE mr."staffId" = :staffId and  mr.id = :requestId and mr."deletedAt" is null
`;

  const assignedRequest = (
    await db.sequelize.query(dataQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        staffId: params.staffId,
        requestId: params.requestId,
      },
    })
  )[0];

  if (!assignedRequest) {
    throw new AppError(reference, "Request not found", "custom", 404);
  }
  return assignedRequest;
};
