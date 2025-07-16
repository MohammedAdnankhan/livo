const { LANGUAGES, CONTRACT_STATUSES } = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const { isArrayEmpty } = require("../../utils/utility");

/**
 * @async
 * @function getActiveTenantsForOwner
 * @param {object} params
 * @param {string[]} params.buildingIds
 * @param {string} params.flatId
 * @param {string} params.ownerId
 * @param {object} pagination
 * @param {number} pagination.offset
 * @param {number} pagination.limit
 * @param {string} [language = LANGUAGES.EN] language
 * @returns {Promise<{count: number, data: object[]}>}
 * @description Lists all the active tenants residing in your flats
 */
async function getActiveTenantsForOwner(
  { buildingIds, flatId, ownerId },
  { offset, limit },
  language = LANGUAGES.EN
) {
  const activeTenantsCountQuery = `
    SELECT COUNT(mu.id)::INTEGER FROM master_users mu
    JOIN (
      SELECT DISTINCT ON(fc1."masterUserId") * FROM flat_contracts fc1
      JOIN flats f1 ON (f1.id = fc1."flatId" AND f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId)
      WHERE fc1."deletedAt" IS NULL
      ORDER BY fc1."masterUserId", fc1."createdAt" DESC
    ) AS fc ON (fc."masterUserId" = mu.id AND (fc."contractEndDate" + INTERVAL '1 month' * fc."grace" > NOW()) AND fc."isValid" IS true)
    JOIN flats f ON (f.id = fc."flatId" AND f."deletedAt" IS NULL ${
      flatId ? `AND f.id = :flatId` : ""
    })
    JOIN buildings b ON (b.id = f."buildingId" AND b.id IN (:buildingIds))
    WHERE mu."deletedAt" IS NULL`;

  const activeTenantsQuery = `
    SELECT mu.id, mu.name, mu."profilePicture",
    f.id AS "flat.id", f.name_${language} AS "flat.name", f.floor AS "flat.floor", 
    b.id AS "building.id", b.name_${language} AS "building.name",
    fc."contractEndDate" + INTERVAL '1 month' * fc."grace" AS "contractEndDate", '${
      CONTRACT_STATUSES.ACTIVE
    }' AS "contractStatus" , fc."noticePeriod",
    CASE WHEN (fc."contractEndDate" + INTERVAL '1 month' * fc.grace - NOW()) <= (INTERVAL '1 month' * fc."noticePeriod") THEN true
    ELSE false END AS "isExpiring" FROM master_users mu
    JOIN (
      SELECT DISTINCT ON(fc1."masterUserId") * FROM flat_contracts fc1
      JOIN flats f1 ON (f1.id = fc1."flatId" AND f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId)
      WHERE fc1."deletedAt" IS NULL
      ORDER BY fc1."masterUserId", fc1."createdAt" DESC
    ) AS fc ON (fc."masterUserId" = mu.id AND (fc."contractEndDate" + INTERVAL '1 month' * fc."grace" > NOW()) AND fc."isValid" IS true)
    JOIN flats f ON (f.id = fc."flatId" AND f."deletedAt" IS NULL ${
      flatId ? `AND f.id = :flatId` : ""
    })
    JOIN buildings b ON (b.id = f."buildingId" AND b.id IN (:buildingIds))
    WHERE mu."deletedAt" IS NULL ORDER BY mu.name ASC LIMIT :limit OFFSET :offset`;

  const [[{ count }], activeTenants] = await Promise.all([
    db.sequelize.query(activeTenantsCountQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        buildingIds,
        flatId,
        ownerId,
      },
    }),
    db.sequelize.query(activeTenantsQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        buildingIds,
        flatId,
        ownerId,
        offset,
        limit,
      },
    }),
  ]);

  const response = {
    count,
    data: activeTenants,
  };
  return response;
}

/**
 * @async
 * @function getInActiveTenantsForOwner
 * @description Lists all the In-Active tenants that have resided in your flats
 * @param {object} params
 * @param {string[]} params.buildingIds
 * @param {string} params.flatId
 * @param {string} params.ownerId
 * @param {object} pagination
 * @param {number} pagination.offset
 * @param {number} pagination.limit
 * @param {string} language
 * @returns {Promise<{count: number, data: object[]}>}
 */
async function getInActiveTenantsForOwner(
  { buildingIds, flatId, ownerId },
  { offset, limit },
  language = LANGUAGES.EN
) {
  const inActiveTenantsCountQuery = `
    SELECT COUNT(mu.id)::INTEGER FROM master_users mu
    JOIN (
      SELECT DISTINCT ON(fc1."masterUserId") * FROM flat_contracts fc1
      JOIN flats f1 ON (f1.id = fc1."flatId" AND f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId)
      WHERE fc1."deletedAt" IS NULL
      ORDER BY fc1."masterUserId", fc1."createdAt" DESC
    ) AS fc ON (fc."masterUserId" = mu.id AND (fc."contractEndDate" + INTERVAL '1 month' * fc."grace" < NOW() OR fc."isValid" IS false))
    JOIN flats f ON (f.id = fc."flatId" AND f."deletedAt" IS NULL ${
      flatId ? `AND f.id = :flatId` : ""
    })
    JOIN buildings b ON (b.id = f."buildingId" AND b.id IN (:buildingIds))
    WHERE mu."deletedAt" IS NULL`;

  const inActiveTenantsQuery = `
    SELECT mu.id, mu.name, mu."profilePicture",
    f.id AS "flat.id", f.name_${language} AS "flat.name", f.floor AS "flat.floor", 
    b.id AS "building.id", b.name_${language} AS "building.name",
    fc."contractEndDate" + INTERVAL '1 month' * fc."grace" AS "contractEndDate", '${
      CONTRACT_STATUSES.IN_ACTIVE
    }' AS "contractStatus" FROM master_users mu
    JOIN (
      SELECT DISTINCT ON(fc1."masterUserId") * FROM flat_contracts fc1
      JOIN flats f1 ON (f1.id = fc1."flatId" AND f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId)
      WHERE fc1."deletedAt" IS NULL
      ORDER BY fc1."masterUserId", fc1."createdAt" DESC
    ) AS fc ON (fc."masterUserId" = mu.id AND (fc."contractEndDate" + INTERVAL '1 month' * fc."grace" < NOW() OR fc."isValid" IS false))
    JOIN flats f ON (f.id = fc."flatId" AND f."deletedAt" IS NULL ${
      flatId ? `AND f.id = :flatId` : ""
    })
    JOIN buildings b ON (b.id = f."buildingId" AND b.id IN (:buildingIds))
    WHERE mu."deletedAt" IS NULL ORDER BY mu.name ASC LIMIT :limit OFFSET :offset`;

  const [[{ count }], inActiveTenants] = await Promise.all([
    db.sequelize.query(inActiveTenantsCountQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        buildingIds,
        flatId,
        ownerId,
      },
    }),
    db.sequelize.query(inActiveTenantsQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        buildingIds,
        flatId,
        ownerId,
        offset,
        limit,
      },
    }),
  ]);

  const response = {
    count,
    data: inActiveTenants,
  };
  return response;
}

/**
 * @async
 * @function getTenantDetails
 * @description Detail of tenant to be viewed by the owner
 * @param {object} params
 * @param {string} params.ownerId
 * @param {string} params.tenantId
 * @returns {Promise<object>}
 */
async function getTenantDetails({ ownerId, tenantId }) {
  const reference = "getTenantDetails";

  const getTenantQuery = `
    SELECT mu.id, mu.name, mu."profilePicture", mu."countryCode", mu."mobileNumber", mu.email, mu."dateOfBirth", mu."nationality",
    mu.gender, mu.documents, mu."documentId", mu."documentType", mu."documentDetails", mu."alternateContact",
    bd."accountHolderName" as "bankDetails.accountHolderName", bd."bankName" as "bankDetails.bankName", bd."accountNumber" as "bankDetails.accountNumber",
    bd."swiftCode" as "bankDetails.swiftCode", fc1.id AS "contractId"
    FROM master_users mu
    JOIN bank_details bd ON (bd."masterUserId" = mu.id AND bd."deletedAt" IS NULL)
    JOIN (
      SELECT DISTINCT ON (fc."masterUserId") fc.id, fc."masterUserId"
      FROM flat_contracts fc
      JOIN flats f1 ON (f1.id = fc."flatId" AND f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId)
      WHERE fc."deletedAt" IS NULL 
      ORDER BY fc."masterUserId", fc."createdAt" DESC
    ) AS fc1 ON (fc1."masterUserId" = mu.id)
    WHERE mu."deletedAt" IS NULL and mu.id = :tenantId LIMIT 1`;

  const tenant = await db.sequelize.query(getTenantQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      ownerId,
      tenantId,
    },
  });
  if (isArrayEmpty(tenant)) {
    throw new AppError(reference, "No tenant found", "custom", 404);
  }

  return tenant[0];
}

//FIXME: function should be in contract service
async function getContractDetails({ contractId, ownerId }) {
  const reference = "getContractDetails";
  const getContractDetailsQuery = `
      SELECT 
        fc."id", 
        fc."contractId", 
        fc."flatUsage", 
        fc."contractImage", 
        fc."contractStartDate", 
        fc."contractEndDate", 
        fc."moveInDate", 
        fc."moveOutDate", 
        fc."isValid", 
        fc."expiryReason", 
        fc."expiredAt", 
        fc."securityDeposit", 
        fc."activationFee", 
        fc."paymentFrequency", 
        fc."currency",
        (SELECT cp.amount FROM contract_payments AS cp WHERE cp."contractId" = fc.id LIMIT 1) AS "rentAmount",
        fc."noticePeriod", 
        fc."grace", 
        fc."description", 
        fc."createdAt", 
        f."id" AS "flat.id", 
        f."name_en" AS "flat.name_en", 
        f."name_ar" AS "flat.name_ar", 
        "f->owner"."id" AS "flat.owner.id", 
        "f->owner"."name" AS "flat.owner.name", 
        "f->owner"."email" AS "flat.owner.email", 
        "f->owner"."mobileNumber" AS "flat.owner.mobileNumber", 
        "f->building"."id" AS "flat.building.id", 
        "f->building"."name_en" AS "flat.building.name_en", 
        "f->building"."name_ar" AS "flat.building.name_ar",
        CASE 
          WHEN fc."isValid" IS TRUE AND fc."contractEndDate" + INTERVAL '1 month' * fc."grace" > NOW() THEN '${CONTRACT_STATUSES.ACTIVE}' 
          WHEN fc."isValid" IS FALSE OR fc."contractEndDate" + INTERVAL '1 month' * fc."grace" < NOW() THEN '${CONTRACT_STATUSES.IN_ACTIVE}'   
          ELSE NULL 
        END AS "leaseStatus"
      FROM 
        "flat_contracts" AS fc 
        LEFT OUTER JOIN (
          "flats" AS f 
          LEFT OUTER JOIN "master_users" AS "f->owner" ON f."ownerId" = "f->owner"."id"  
        )
        LEFT OUTER JOIN "buildings" AS "f->building" ON (
          f."buildingId" = "f->building"."id" 
          AND "f->building"."deletedAt" IS NULL 
          AND "f->building"."propertyId" = "f->owner"."propertyId"
        )
        ON fc."flatId" = f."id" AND f."deletedAt" IS NULL
      WHERE 
        (
          fc."deletedAt" IS NULL 
          AND fc."id" = :contractId
          AND f."ownerId" = :ownerId
          AND f."deletedAt" is null
        );

`;

  const getDetails = await db.sequelize.query(getContractDetailsQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      contractId,
      ownerId,
    },
  });

  if (getDetails.length === 0) {
    throw new AppError(reference, "No contract found", "custom", 404);
  }

  return getDetails[0];
}

module.exports = {
  getActiveTenantsForOwner,
  getInActiveTenantsForOwner,
  getTenantDetails,
  getContractDetails,
};
