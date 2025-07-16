const {
  LEASE_STATUSES,
  TIMEZONES,
  LEASE_TARGETS,
  FLAT_USAGE,
  leaseTypes,
} = require("../../config/constants");
const db = require("../../database");
const {
  getSubFlatFromParamsAndPropertyId,
} = require("../../subFlat-service/controllers/subFlat");
const {
  createUserAfterLeaseApproval,
  deleteUser,
} = require("../../user-service/controllers/user");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const {
  isArrayEmpty,
  hashPassword,
  generatePassword,
  isObjEmpty,
} = require("../../utils/utility");
const Lease = require("../models/Lease");
const LeaseAmenity = require("../models/LeaseAmenity");
const LeaseStatus = require("../models/LeaseStatus");
const LeaseTerm = require("../models/LeaseTerm");
const moment = require("moment-timezone");
const leaseUtils = require("./lease.utility");
const { Op } = require("sequelize");
const { signupCompletedByAdminForUser } = require("../../utils/email");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const LeaseReminder = require("../../leaseReminder-service/models/LeaseReminder");

async function getFlatIncludingBuilding(params, scope = null) {
  return await Flat.scope(scope).findOne({
    where: params,
    include: [
      {
        model: Building,
        as: "building",
        attributes: [],
        required: true,
      },
    ],
  });
} //Added due to circular dependency

async function getMasterUser(params) {
  return await MasterUser.findOne({ where: params });
} //Added due to circular dependency

/**
 * @async
 * @function getLeaseWithLatestStatus
 * @param {*} params
 * @description Function to get lease with
 * @returns
 */
exports.getLeaseWithLatestStatus = async (params) => {
  return await Lease.findOne({
    where: params,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: LeaseStatus,
        as: "statuses",
        required: true,
        limit: 1,
        order: [["createdAt", "DESC"]],
      },
    ],
  });
};

module.exports.getTenantDetailsFromLease = async (params) => {
  const query = `select mu.id,mu.name,mu."mobileNumber",mu."countryCode",mu.email from leases l 
join master_users mu on(l."masterUserId" = mu.id and mu."deletedAt" is null)
where l."flatId" = :flatId order by l."createdAt" desc limit 1`;

  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        flatId: params.flatId,
      },
    })
  )[0];
};

/**
 * @async
 * @function createLeaseDraft
 * @param {import("../types").ICreateLeaseDraft} data
 * @param {string} propertyId
 * @returns {Promise<null>}
 * @description Function to create a draft lease
 */
exports.createLeaseDraft = async (data, propertyId) => {
  const reference = "createLeaseDraft";
  const expectedLeaseStatuses = new Array(
    LEASE_STATUSES.CANCELLED,
    LEASE_STATUSES.EXPIRED,
    LEASE_STATUSES.TERMINATED
  );

  if (data.flatId) {
    const [flat, existingFlatLease] = await Promise.all([
      getFlatIncludingBuilding({
        id: data.flatId,
        "$building.propertyId$": propertyId,
      }),
      this.getLeaseWithLatestStatus({
        flatId: data.flatId,
      }),
    ]);
    if (!flat) {
      throw new AppError(reference, "Flat not found", "custom", 404);
    }

    if (
      existingFlatLease &&
      !expectedLeaseStatuses.includes(
        existingFlatLease["statuses"][0]["status"]
      )
    ) {
      throw new AppError(
        reference,
        `A lease in ${existingFlatLease["statuses"][0]["status"]} stage exists for the selected tenant`,
        "custom",
        412
      );
    }
    if (data.ownerId && flat.ownerId && flat.ownerId != data.ownerId) {
      throw new AppError(reference, "An owner already exists in this flat!", "custom", 412);
    }

    if (data.ownerId) {
      const owner = await MasterUser.findOne({
        where: { id: data.ownerId, propertyId: propertyId },
      });
      if (!owner) {
        throw new AppError(reference, "Owner not found", "custom", 404);
      }
    }
  } else {
    //We know if flatId is not there then subFlatId exists
    const [subFlat, existingSubFlatLease] = await Promise.all([
      getSubFlatFromParamsAndPropertyId({
        params: { id: data.subFlatId },
        propertyId,
      }),
      this.getLeaseWithLatestStatus({
        subFlatId: data.subFlatId,
      }),
    ]);
    if (!subFlat) {
      throw new AppError(reference, "Sub unit not found", "custom", 404);
    }

    if (
      existingSubFlatLease &&
      !expectedLeaseStatuses.includes(
        existingSubFlatLease["statuses"][0]["status"]
      )
    ) {
      throw new AppError(
        reference,
        `A lease in ${existingSubFlatLease["statuses"][0]["status"]} stage exists for the sub unit`,
        "custom",
        412
      );
    }
  }

  const [user, existingUserLease] = await Promise.all([
    getMasterUser({ id: data.masterUserId, propertyId }),
    this.getLeaseWithLatestStatus({ masterUserId: data.masterUserId }),
  ]);

  if (!user) {
    throw new AppError(reference, "User/Company not found", "custom", 404);
  }

  if (
    existingUserLease &&
    !expectedLeaseStatuses.includes(existingUserLease["statuses"][0]["status"])
  ) {
    throw new AppError(
      reference,
      `A lease in ${existingUserLease["statuses"][0]["status"]} stage exists for user`,
      "custom",
      412
    );
  }

  const { amenities, terms, ownerId, ...leaseData } = data;
  const transaction = await db.sequelize.transaction();
  try {
    if (data.ownerId) {
      await Flat.update(
        { ownerId },
        { where: { id: data.flatId }, transaction }
      );
    }
    const lease = await Lease.create(leaseData, { transaction });
    await LeaseStatus.create(
      { leaseId: lease.id, status: LEASE_STATUSES.DRAFT },
      { transaction }
    );

    if (amenities && !isArrayEmpty(amenities)) {
      amenities.forEach((amenity) => {
        amenity["leaseId"] = lease.id;
      });
      await LeaseAmenity.bulkCreate(amenities, { transaction });
    }
    if (terms && !isArrayEmpty(terms)) {
      await LeaseTerm.bulkCreate(
        terms.map((term) => {
          return { leaseId: lease.id, term };
        }),
        { transaction }
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return null;
};

/**
 * @async
 * @function getLeasesForAdmin
 * @param {import("../types").IGetLeasesForAdmin} params
 * @param {import("../../utils/types").IPagination} paginate
 * @param {"Asia/Dubai" | "Asia/Kolkata"} timezone
 * @returns {Promise<{count: number, rows: object[]}>}
 * @description Function to list all leases for Admin
 */
exports.getLeasesForAdmin = async (
  params,
  paginate,
  timezone = TIMEZONES.INDIA
) => {
  const countAttributes = `COUNT(l.id)::INTEGER AS count`;
  const leaseAttributes = `l.id, l."leaseId", l."startDate", l."endDate", l."flatUsage", l."rentAmount", l."securityDeposit", ls.status,lr."createdAt" as "lastScheduled", l."currency",
    CASE WHEN l."flatId" IS NULL THEN sf.name_en ELSE f.name_en END AS name_en, b.name_en AS "building.name_en",
    CASE WHEN l."flatId" IS NULL THEN '${LEASE_TARGETS.SUB_FLAT}' ELSE '${LEASE_TARGETS.FLAT}' END AS "leaseTarget"`;

  let leaseLogicalQuery = `leases l 
    JOIN (
      SELECT DISTINCT ON("leaseId") id, "leaseId", status, "createdAt" FROM lease_statuses
      WHERE "deletedAt" IS NULL ORDER BY "leaseId", "createdAt" DESC
    ) ls ON (l.id = ls."leaseId")
      LEFT JOIN (
        SELECT DISTINCT ON("leaseId") id,"createdAt","leaseId"
        FROM lease_reminders
        WHERE "deletedAt" IS NULL
        ORDER BY "leaseId", "createdAt" DESC
    ) lr ON (l.id = lr."leaseId")
    LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
    LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
    JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
    WHERE l."deletedAt" IS NULL AND b."propertyId" = :propertyId`;

  if (params.status) {
    leaseLogicalQuery += ` AND ls.status = :status`;
  }

  if (params.buildingId) {
    leaseLogicalQuery += ` AND b.id = :buildingId`;
  }

  if (params.flatId) {
    leaseLogicalQuery += ` AND f.id = :flatId`;
  }

  if (params.flatUsage) {
    leaseLogicalQuery += ` AND l."flatUsage" = :flatUsage`;
  }

  if (params.startDate) {
    if (params.sortByExpiry) {
      leaseLogicalQuery += ` AND l."endDate"  + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) >= :startDate`;
    } else {
      leaseLogicalQuery += ` AND l."startDate" >= :startDate`;
    }
  }

  if (params.endDate) {
    if (params.sortByExpiry) {
      leaseLogicalQuery += ` AND l."endDate"  + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) <= :endDate`;
    } else {
      leaseLogicalQuery += ` AND l."startDate" <= :endDate`;
    }
  }

  if (params.search) {
    leaseLogicalQuery += ` AND (l."leaseId"::VARCHAR ILIKE '%${params.search}%' OR b.name_en ILIKE '%${params.search}%' OR f.name_en ILIKE '%${params.search}%' OR sf.name_en ILIKE '%${params.search}%' OR l."flatUsage" ILIKE '%${params.search}%')`;
  }

  const leasesCountQuery = `SELECT ${countAttributes} FROM ${leaseLogicalQuery}`;
  const leasesDataQuery = `SELECT ${leaseAttributes} FROM ${leaseLogicalQuery} ORDER BY  ${
    !params.startDate && !params.endDate && params.sortByExpiry
      ? ` l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) ASC`
      : `l."createdAt" DESC`
  } LIMIT :limit OFFSET :offset`;

  const leasesQueryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      buildingId: params.buildingId,
      status: params.status,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: paginate.limit,
      offset: paginate.offset,
      flatUsage: params.flatUsage,
      flatId: params.flatId,
    },
  };

  const [[{ count }], leases] = await Promise.all([
    db.sequelize.query(leasesCountQuery, leasesQueryConfig),
    db.sequelize.query(leasesDataQuery, leasesQueryConfig),
  ]);

  leases.forEach((lease) => {
    lease.timePeriod = leaseUtils.calculateTimePeriodInDays(
      lease.startDate,
      lease.endDate
    );
    lease.startDate = moment(lease.startDate).tz(timezone).format();
    lease.endDate = moment(lease.endDate).tz(timezone).format();
  });

  return { count, rows: leases };
};

/**
 * @async
 * @function getLeaseDetailsForAdmin
 * @param {import("../types").IGetLease} params
 * @param {"Asia/Dubai" | "Asia/Kolkata"} timezone
 * @returns {Promise<object>}
 * @description Function to get details of the lease for admin
 */
exports.getLeaseDetailsForAdmin = async (
  params,
  timezone = TIMEZONES.INDIA
) => {
  const reference = "getLeaseDetailsForAdmin";
  const leaseQuery = `
    SELECT l.id, l."leaseId", l."startDate", l."endDate", l."moveInDate", l."moveOutDate", l."flatUsage", l."rentAmount", l.documents, l."securityDeposit",
    l."activationFee", l."paymentFrequency", l."paymentMode", l.currency, l."noticePeriod", l.discount, l.description,
    CASE WHEN l."flatId" IS NULL THEN sf.name_en ELSE f.name_en END AS name_en, b.name_en AS "building.name_en", b.id AS "building.id",
    CASE WHEN l."flatId" IS NULL THEN '${LEASE_TARGETS.SUB_FLAT}' ELSE '${LEASE_TARGETS.FLAT}' END AS "leaseTarget",
    CASE WHEN l."flatId" IS NULL THEN f1.id ELSE l."flatId" END AS "flat.id",
    mu.id AS "tenant.id", mu.name AS "tenant.name", mu.email AS "tenant.email", mu."countryCode" AS "tenant.countryCode", mu."mobileNumber" AS "tenant.mobileNumber", mu."isCompany" AS "tenant.isCompany",
    mu1.id AS "owner.id", mu1.name AS "owner.name", mu1.email AS "owner.email", mu1."countryCode" AS "owner.countryCode", mu1."mobileNumber" AS "owner.mobileNumber", mu1."isCompany" AS "owner.isCompany"
    FROM leases l 
    LEFT JOIN master_users mu ON (mu.id = l."masterUserId" AND mu."deletedAt" IS NULL)
    LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
    LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
    JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
    LEFT JOIN master_users mu1 ON ((mu1.id = f."ownerId" OR mu1.id = f1."ownerId") AND mu1."deletedAt" IS NULL)
    WHERE l."deletedAt" IS NULL AND b."propertyId" = :propertyId AND l.id = :leaseId`;

  const leaseQueryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      leaseId: params.leaseId,
      propertyId: params.propertyId,
    },
  };

  const leaseStatusesConfig = {
    where: {
      leaseId: params.leaseId,
    },
    order: [["createdAt", "DESC"]],
    attributes: ["status", "createdAt", "comment"],
  };
  const leaseRemindersConfig = {
    where: {
      leaseId: params.leaseId,
    },
    order: [["createdAt", "DESC"]],
    attributes: [
      "createdAt",
      "scheduledFor",
      "smsTitle",
      "smsBody",
      [
        db.Sequelize.literal(
          `CASE WHEN CAST(DATE_TRUNC('MINUTE', "cronTime" ::timestamp ) AS TIMESTAMP) AT TIME ZONE 'UTC'> now() THEN 'Pending' ELSE 'Sent' END`
        ),
        "status",
      ],
      "cronTime",
    ],
  };

  const leaseAmenitiesConfig = {
    where: {
      leaseId: params.leaseId,
    },
    attributes: ["itemName", "itemIds", "quantity", "description"],
  };

  const leaseTermsConfig = {
    where: {
      leaseId: params.leaseId,
    },
    attributes: ["term"],
  };

  const [[lease], statuses, amenities, terms, reminders] = await Promise.all([
    db.sequelize.query(leaseQuery, leaseQueryConfig),
    LeaseStatus.findAll(leaseStatusesConfig),
    LeaseAmenity.findAll(leaseAmenitiesConfig),
    LeaseTerm.findAll(leaseTermsConfig),
    LeaseReminder.findAll(leaseRemindersConfig),
  ]);

  if (!lease) {
    throw new AppError(reference, "Lease not found", "custom", 404);
  }

  lease.startDate = moment(lease.startDate).tz(timezone).format();
  lease.endDate = moment(lease.endDate).tz(timezone).format();

  statuses.forEach((status) => {
    status.setDataValue(
      "createdAt",
      moment(status.createdAt).tz(timezone).format()
    );
  });
  return {
    ...lease,
    statuses,
    terms: terms.map(({ term }) => term),
    amenities,
    reminders,
  };
};

/**
 * @async
 * @function changeLeaseStatusForAdmin
 * @param {import("../types").IChangeLeaseStatusForAdmin} data
 * @returns {Promise<null>}
 * @description Function to change status of a lease to cancelled or active for admin
 */
exports.changeLeaseStatusForAdmin = async (data) => {
  const reference = "changeLeaseStatusForAdmin";
  const leaseQuery = `
    SELECT l.id, l."flatId", l."subFlatId", ls.status, mu.name AS "tenant.name", mu.email AS "tenant.email",
    mu."countryCode" AS "tenant.countryCode", mu."mobileNumber" AS "tenant.mobileNumber", mu."profilePicture" AS "tenant.profilePicture", b.name_en AS "tenant.buildingName"
    FROM leases l
    JOIN (
      SELECT DISTINCT ON("leaseId") "leaseId", status FROM lease_statuses
      WHERE "deletedAt" IS NULL ORDER BY "leaseId", "createdAt" DESC
    ) ls ON (l.id = ls."leaseId")
    JOIN master_users mu ON (mu.id = l."masterUserId" AND mu."deletedAt" IS NULL)
    LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
    LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
    JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
    WHERE l."deletedAt" IS NULL AND b."propertyId" = :propertyId AND l.id = :leaseId`;

  const [lease] = await db.sequelize.query(leaseQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      leaseId: data.leaseId,
      propertyId: data.propertyId,
    },
  });

  if (!lease) {
    throw new AppError(reference, "Lease not found", "custom", 404);
  }

  if (lease.status !== LEASE_STATUSES.DRAFT) {
    throw new AppError(
      reference,
      `You cannot change status of a lease in ${lease.status} stage`,
      "custom",
      412
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
    await LeaseStatus.create(
      { leaseId: lease.id, status: data.status },
      { transaction }
    );
    if (data.status === LEASE_STATUSES.ACTIVE) {
      const { tenant } = lease;
      const password = generatePassword();

      logger.info(`${tenant.mobileNumber}: ${password}`); //TODO: remove once email setup is done

      tenant.password = await hashPassword(password);
      if (lease.flatId) {
        tenant.flatId = lease.flatId;
      } else {
        tenant.subFlatId = lease.subFlatId;
      }

      await createUserAfterLeaseApproval(tenant, transaction);
      const emailToUserObj = {
        buildingName: tenant["buildingName"],
        residentName: tenant["name"],
        residentMobileNumber: tenant["mobileNumber"],
        password,
      };
      signupCompletedByAdminForUser(tenant["email"], emailToUserObj);
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  return null;
};

/**
 * @async
 * @function terminateLeaseForAdmin
 * @param {object} data
 * @param {string} data.leaseId
 * @param {string} data.propertyId
 * @returns {Promise<null>}
 * @description Function to terminate a lease for admin
 */
exports.terminateLeaseForAdmin = async (data) => {
  const reference = "terminateLeaseForAdmin";
  const leaseQuery = `
    SELECT l.id, ls.status, mu.email AS "tenant.email", mu."mobileNumber" AS "tenant.mobileNumber"
    FROM leases l
    JOIN (
      SELECT DISTINCT ON("leaseId") "leaseId", status FROM lease_statuses
      WHERE "deletedAt" IS NULL ORDER BY "leaseId", "createdAt" DESC
    ) ls ON (l.id = ls."leaseId")
    JOIN master_users mu ON (mu.id = l."masterUserId" AND mu."deletedAt" IS NULL)
    LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
    LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
    JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
    WHERE l."deletedAt" IS NULL AND b."propertyId" = :propertyId AND l.id = :leaseId`;

  const [lease] = await db.sequelize.query(leaseQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      leaseId: data.leaseId,
      propertyId: data.propertyId,
    },
  });

  if (!lease) {
    throw new AppError(reference, "Lease not found", "custom", 404);
  }

  if (lease.status !== LEASE_STATUSES.ACTIVE) {
    throw new AppError(
      reference,
      `You cannot terminate a non active lease`,
      "custom",
      412
    );
  }

  await LeaseStatus.create({
    leaseId: lease.id,
    status: LEASE_STATUSES.TERMINATED,
    comment: data.comment ? data.comment : null,
  });
  deleteUser({ mobileNumber: lease["tenant"]["mobileNumber"] }, null).catch(
    (err) => {
      console.log("Error while deleting user after lease termination", err); //TODO: remove console before moving to live environment
    }
  );
  return null;
};

/**
 * @async
 * @function updateLeaseDraftForAdmin
 * @param {import("../types").IGetLease} params
 * @param {import("../types").IUpdateLeaseDraft} leaseData
 * @description Function to update a draft lease
 * @returns {Promise<null>}
 */
exports.updateLeaseDraftForAdmin = async (params, leaseData) => {
  const reference = "updateLeaseDraftForAdmin";
  const lease = await this.getLeaseWithLatestStatus({ id: params.leaseId }); //TODO: enforce propertyId check for isolation
  if (!lease) {
    throw new AppError(reference, "Lease not found", "custom", 404);
  }
  if (lease["statuses"][0]["status"] !== LEASE_STATUSES.DRAFT) {
    throw new AppError(
      reference,
      "Lease can only be updated in Draft stage",
      "custom",
      412
    );
  }

  const { amenities, terms, ...data } = leaseData;

  if (data.masterUserId) {
    const existingLease = await Lease.findOne({
      where: { masterUserId: data.masterUserId },
      include: [
        {
          model: LeaseStatus,
          as: "statuses",
          required: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
      ],
    });
    const inActiveStatuses = [
      LEASE_STATUSES.CANCELLED,
      LEASE_STATUSES.EXPIRED,
      LEASE_STATUSES.TERMINATED,
    ];
    if (
      existingLease &&
      !inActiveStatuses.includes(existingLease.statuses[0].status)
    ) {
      throw new AppError(
        "reference",
        `A lease is already exists in ${existingLease.statuses[0].status} stage for selected Tenant`,
        "custom",
        412
      );
    }
  }
  for (const key in data) {
    lease[key] = data[key];
  }

  //TODO: monitor for edge cases. If found relating to data redundancy, use transactions(most probably)

  if (terms) {
    const existingTerms = await LeaseTerm.findAll({
      where: { leaseId: params.leaseId },
      attributes: ["id", "term", "deletedAt"],
      paranoid: false,
    });

    const existingTermNames = existingTerms.map(({ term }) => term);

    const termsToAdd = terms.reduce((initialTermArr, term) => {
      if (!existingTermNames.includes(term)) {
        initialTermArr.push({ term, leaseId: params.leaseId });
      }
      return initialTermArr;
    }, []);

    const termIdsToDeleteAndRestore = existingTerms.reduce(
      (termIdsObj, { deletedAt, term, id }) => {
        if (!terms.includes(term) && !deletedAt) {
          termIdsObj["delete"].push(id);
        }
        if (terms.includes(term) && deletedAt) {
          termIdsObj["restore"].push(id);
        }
        return termIdsObj;
      },
      { delete: [], restore: [] }
    );

    if (!isArrayEmpty(termsToAdd)) {
      await LeaseTerm.bulkCreate(termsToAdd);
    }

    if (!isArrayEmpty(termIdsToDeleteAndRestore["delete"])) {
      LeaseTerm.destroy({
        where: {
          id: { [Op.in]: termIdsToDeleteAndRestore["delete"] },
        },
      }).catch();
    }

    if (!isArrayEmpty(termIdsToDeleteAndRestore["restore"])) {
      LeaseTerm.restore({
        where: {
          id: { [Op.in]: termIdsToDeleteAndRestore["restore"] },
        },
      }).catch();
    }
  }

  if (amenities) {
    //TODO: find optimized/better option to handle update scenario for lease amenities
    LeaseAmenity.findAll({
      where: { leaseId: params.leaseId },
      attributes: ["id"],
    })
      .then((leaseAmenities) => {
        if (!isArrayEmpty(leaseAmenities)) {
          LeaseAmenity.destroy({
            where: {
              id: { [Op.in]: leaseAmenities.map(({ id }) => id) },
            },
            force: true,
          });
        }
      })
      .then(() => {
        if (!isArrayEmpty(amenities)) {
          LeaseAmenity.bulkCreate(
            amenities.map((amenity) => {
              return { ...amenity, leaseId: params.leaseId };
            })
          ).catch();
        }
      })
      .catch();
  }

  await lease.save();
  return null;
};

exports.getLeaseExportsForAdmin = async (
  params,
  timezone = TIMEZONES.INDIA
) => {
  const leaseAttributes = `l.id, l."leaseId", l."startDate", l."endDate", l."flatUsage", l."rentAmount", ls.status, l."masterUserId",  l."documents", 
   l."moveInDate", l."moveOutDate", l."securityDeposit",  l."activationFee",  l."paymentFrequency",  l."paymentMode",  l."currency", l."noticePeriod", l."discount", l."description",   l."createdAt", 
  f."id" AS "flat.id", 
  f."name_en" AS "flat.name_en", 
  f."name_ar" AS "flat.name_ar", 
  b."id" AS "flat.buildingId", 
  b."name_en" AS "flat.building.name_en", 
  b."name_ar" AS "flat.building.name_ar",
  resident.id AS "resident.id",
  resident.name AS "resident.name",
  resident."mobileNumber" AS "resident.mobileNumber",
  resident.email  AS "resident.email",
  owner.name AS "owner.name",
  owner.id AS "owner.id",
  owner.email AS "owner.email",
  owner."mobileNumber" AS "owner.mobileNumber"
  `;

  let leaseLogicalQuery = `leases l 
    JOIN (
      SELECT DISTINCT ON("leaseId") id, "leaseId", status, "createdAt" FROM lease_statuses
      WHERE "deletedAt" IS NULL ORDER BY "leaseId", "createdAt" DESC
    ) ls ON (l.id = ls."leaseId")
    LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
    LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
    JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
    LEFT OUTER JOIN "master_users" AS "owner"  ON (f."ownerId" = "owner"."id" AND "owner"."deletedAt" is null)
     LEFT OUTER JOIN "master_users" AS "resident" ON l."masterUserId" = "resident"."id" 
  AND ("resident"."deletedAt" IS NULL) 
    WHERE l."deletedAt" IS NULL AND b."propertyId" = :propertyId`;

  if (params.status) {
    leaseLogicalQuery += ` AND ls.status = :status`;
  }

  if (params.buildingId) {
    leaseLogicalQuery += ` AND b.id = :buildingId`;
  }

  if (params.flatId) {
    leaseLogicalQuery += ` AND f.id = :flatId`;
  }

  if (params.flatUsage) {
    leaseLogicalQuery += ` AND l."flatUsage" = :flatUsage`;
  }

  if (params.startDate) {
    leaseLogicalQuery += ` AND l."createdAt" >= :startDate`;
  }

  if (params.endDate) {
    leaseLogicalQuery += ` AND l."createdAt" <= :endDate`;
  }

  if (params.search) {
    leaseLogicalQuery += ` AND (l."leaseId"::VARCHAR ILIKE '%${params.search}%' OR b.name_en ILIKE '%${params.search}%' OR f.name_en ILIKE '%${params.search}%' OR sf.name_en ILIKE '%${params.search}%' OR l."flatUsage" ILIKE '%${params.search}%')`;
  }

  const leasesDataQuery = `SELECT ${leaseAttributes} FROM ${leaseLogicalQuery} ORDER BY l."createdAt" DESC`;

  const leasesQueryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      buildingId: params.buildingId,
      status: params.status,
      startDate: params.startDate,
      endDate: params.endDate,
      flatUsage: params.flatUsage,
      flatId: params.flatId,
    },
  };

  const [leases] = await Promise.all([
    db.sequelize.query(leasesDataQuery, leasesQueryConfig),
  ]);

  leases.forEach((lease) => {
    lease.timePeriod = leaseUtils.calculateTimePeriodInDays(
      lease.startDate,
      lease.endDate
    );
    lease.startDate = moment(lease.startDate).tz(timezone).format();
    lease.endDate = moment(lease.endDate).tz(timezone).format();
  });

  return leases;
};

module.exports.getLeaseForResident = async ({ mobileNumber }, timezone) => {
  const reference = `getLeaseForResident`;
  const query = `
  select l.id, l."leaseId", l."startDate", 
  (l."endDate" + interval '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)) as "endDate",
  l."moveInDate", (l."moveOutDate" + interval '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)) as "moveOutDate",
  l."flatUsage", l."securityDeposit", l."paymentFrequency", l."activationFee",
  l."noticePeriod", l."documents", l."description", l."rentAmount" as "rentAmount", l."discount" as discount,
  f.name_en as "flatName", b.name_en as "buildingName", mu1.name as "ownerName",mu1.email as "ownerEmail",
  mu1."mobileNumber" as "ownerMobileNumber",
  mu1."countryCode"as "countryCode",l.currency
  from (
    select distinct on("leaseId") * from leases
    where "deletedAt" is null
    order by "leaseId", "createdAt" desc
  ) l
  join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on (ls."leaseId" = l.id and ls."deletedAt" is null)
  join master_users mu on (mu.id = l."masterUserId" and mu."deletedAt" is null)
  join flats f on (f.id = l."flatId" and f."deletedAt" is null)
  join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
  left join master_users mu1 on (mu1.id = f."ownerId" and mu1."deletedAt" is null)
  where mu."mobileNumber" = :mobileNumber
  and l."endDate" + interval '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) > now() 
  and ls."status" = '${LEASE_STATUSES.ACTIVE}'
  limit 1`;

  const contract = await db.sequelize.query(query, {
    nest: true,
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      mobileNumber,
    },
  });

  if (isArrayEmpty(contract)) {
    throw new AppError(reference, "No lease found", "custom", 404);
  }

  const contractObj = contract[0];

  const { contractEndDate, noticePeriod } = contractObj;
  contractObj.isExpiring =
    moment(contractEndDate).diff(moment(), "months", true) <= +noticePeriod
      ? true
      : false;
  if (contractObj.moveInDate) {
    contractObj.moveInDate = moment(contractObj.moveInDate)
      .tz(timezone)
      .format();
  }
  if (contractObj.moveOutDate) {
    contractObj.moveOutDate = moment(contractObj.moveOutDate)
      .tz(timezone)
      .format();
  }
  contractObj.startDate = moment(contractObj.startDate).tz(timezone).format();
  contractObj.endDate = moment(contractObj.endDate).tz(timezone).format();

  return contractObj;
};

module.exports.flatUsageStatus = async ({
  startDate,
  endDate,
  propertyId,
  buildingId,
}) => {
  let data = {};
  Object.values(FLAT_USAGE).map((flatUsage) => {
    data[flatUsage] = 0;
  });
  const query = `SELECT "flatUsage", COUNT(*)::INTEGER FROM leases l 
 LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
    LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
    INNER JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" is NULL AND b."propertyId" = :propertyId ${
      buildingId ? `AND b."id" = :buildingId ` : ""
    })
  WHERE l."createdAt"  between :startDate AND :endDate and l."deletedAt" is null
  GROUP BY "flatUsage"`;

  const flatUsage = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
      propertyId,
      buildingId,
    },
  });
  flatUsage.map((usage) => {
    data[usage.flatUsage] = usage.count;
  });
  return data;
};

module.exports.getLeaseStatusAnalytics = async ({
  startDate,
  endDate,
  propertyId,
  buildingId,
}) => {
  let data = {};
  Object.values(LEASE_STATUSES).map((status) => {
    data[status] = 0;
  });
  const query = `SELECT ls."status",
  COUNT(ls."status")::INTEGER
  FROM
    leases l
  join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on ls."leaseId" = l.id
  LEFT JOIN
    flats f ON(f.id = l."flatId" AND f."deletedAt" IS NULL)
  LEFT JOIN
    sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN
    flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  INNER JOIN
    buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL AND b."propertyId" = :propertyId ${
      buildingId ? `AND b."id" = :buildingId ` : ""
    })
  WHERE
    l."createdAt" BETWEEN :startDate AND :endDate and l."deletedAt" is NULL
  GROUP BY
    ls."status"
`;

  const leaseStatuses = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
      propertyId,
      buildingId,
    },
  });
  leaseStatuses.map((leaseStatus) => {
    data[leaseStatus.status] = leaseStatus.count;
  });
  return data;
};

module.exports.getLeaseTypeAnalytics = async ({
  startDate,
  endDate,
  propertyId,
  buildingId,
}) => {
  const query = `
  SELECT
    COUNT(CASE WHEN l."subFlatId" IS NOT NULL  THEN 1 END)::INTEGER AS "Sub Units",
    COUNT(CASE WHEN l."flatId" IS NOT NULL  THEN 1 END)::INTEGER AS "Units"
  FROM
    leases l
  JOIN (
    SELECT DISTINCT ON ("leaseId") *
    FROM lease_statuses
    WHERE "deletedAt" IS NULL 
    ORDER BY "leaseId", "createdAt" DESC
  ) ls ON ls."leaseId" = l.id
  LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  INNER JOIN buildings b ON (
    (b.id = f."buildingId" OR b.id = f1."buildingId") AND
    b."deletedAt" IS NULL AND
    b."propertyId" = :propertyId ${
      buildingId ? `AND b."id" = :buildingId ` : ""
    }
  )
  WHERE
    l."createdAt" BETWEEN :startDate AND :endDate AND
    l."deletedAt" IS NULL AND ls."status" = :status
`;

  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
        propertyId,
        buildingId,
        status: LEASE_STATUSES.ACTIVE,
      },
    })
  )[0];
};
