const db = require("../../database");
const SubFlat = require("../models/SubFlat");
const { getSubFlatFromParamsAndPropertyId, getSubFlat } = require("./subFlat");
const { AppError } = require("../../utils/errorHandler");
const { getFlatWithBuilding } = require("../../flat-service/controllers/flat");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const { Op } = require("sequelize");
const { isArrayEmpty } = require("../../utils/utility");
const {
  LEASE_STATUSES,
  CONTRACT_STATUSES,
  FLAT_STATUSES,
} = require("../../config/constants");

async function getSubFlatsForAdmin(
  {
    propertyId,
    flatId,
    search,
    buildingId,
    status,
    flatType,
    ownerIds,
    furnishing,
    flatIds,
    rentalType,
  },
  { offset, limit }
) {
  const subFlatsCountQuery = `
    SELECT COUNT(sf.id)::INTEGER FROM sub_flats sf
    JOIN flats f ON (f.id = sf."flatId" AND f."deletedAt" IS NULL)
    left join (
          select distinct on(l1."subFlatId") l1.id, l1."subFlatId", ls.status from leases l1
          join lease_statuses ls on (ls."leaseId" = l1.id AND ls."deletedAt" is null)
          where l1."deletedAt" is null order by l1."subFlatId"  desc ,l1."createdAt" desc, ls."createdAt" desc
        ) l on (l."subFlatId" = sf.id)
    JOIN buildings b ON (b.id = f."buildingId" AND b."propertyId" = :propertyId)
    WHERE sf."deletedAt" IS NULL ${flatId ? `AND sf."flatId" = :flatId` : ``}
    ${buildingId ? `AND b."id" = :buildingId` : ""}
    ${
      search
        ? `AND (
      sf.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or sf.furnishing ilike '%${search}%'
      )`
        : ""
    }
    ${
      status
        ? `AND ${
            status === LEASE_STATUSES.ACTIVE
              ? `l.status = :activeLeaseStatus`
              : `(l.id is null or l.status in (:inActiveLeaseStatuses))`
          } `
        : ``
    } 
  ${flatType ? `AND  f."flatType" = '${flatType}'` : ``} 
  ${ownerIds ? `AND f."ownerId" in (:ownerIds)` : ``}
  ${furnishing ? `AND sf."furnishing" = '${furnishing}'` : ``}
  ${flatIds ? `AND f.id in (:flatIds)` : ``}
  ${rentalType ? `AND sf."rentalType" = '${rentalType}'` : ``} 
    `;

  const subFlatsQuery = `
    SELECT sf.id, sf."subFlatId", sf.name_en, sf.size, sf.furnishing, f.id AS "flat.id", f.name_en AS "flat.name_en",
    b.id AS "flat.building.id", b.name_en AS "flat.building.name_en" FROM sub_flats sf
    JOIN flats f ON (f.id = sf."flatId" AND f."deletedAt" IS NULL)
    left join (
          select distinct on(l1."subFlatId") l1.id, l1."subFlatId", ls.status from leases l1
          join lease_statuses ls on (ls."leaseId" = l1.id AND ls."deletedAt" is null)
          where l1."deletedAt" is null order by l1."subFlatId"  desc ,l1."createdAt" desc, ls."createdAt" desc
        ) l on (l."subFlatId" = sf.id)
    JOIN buildings b ON (b.id = f."buildingId" AND b."propertyId" = :propertyId)
    WHERE sf."deletedAt" IS NULL ${flatId ? `AND sf."flatId" = :flatId` : ``} 
    ${buildingId ? `AND b."id" = :buildingId` : ""}
      ${
        search
          ? `AND (
      sf.name_en ILIKE '%${search}%'
      OR f.name_en ILIKE '%${search}%'
      OR b.name_en ILIKE '%${search}%'
      OR sf.furnishing ILIKE '%${search}%'
      OR sf."subFlatId"::VARCHAR ILIKE '%${search}%'
      OR sf.size ILIKE '%${search}%'
      )`
          : ""
      }
          ${
            status
              ? `AND ${
                  status === LEASE_STATUSES.ACTIVE
                    ? `l.status = :activeLeaseStatus`
                    : `(l.id is null or l.status in (:inActiveLeaseStatuses))`
                } `
              : ``
          } 
  ${flatType ? `AND  f."flatType" = '${flatType}'` : ``} 
  ${ownerIds ? `AND f."ownerId" in (:ownerIds)` : ``}
  ${furnishing ? `AND sf."furnishing" = '${furnishing}'` : ``}
  ${flatIds ? `AND f.id in (:flatIds)` : ``}
  ${rentalType ? `AND sf."rentalType" = '${rentalType}'` : ``} 
    ORDER BY sf."createdAt" DESC, sf.name_en DESC LIMIT :limit OFFSET :offset`;

  const queryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId,
      flatId,
      buildingId,
      ownerIds,
      flatIds,
      activeLeaseStatus: LEASE_STATUSES.ACTIVE,
      inActiveLeaseStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      offset,
      limit,
    },
  };

  const [[{ count }], subFlats] = await Promise.all([
    db.sequelize.query(subFlatsCountQuery, queryConfig),
    db.sequelize.query(subFlatsQuery, queryConfig),
  ]);
  const response = {
    count,
    rows: subFlats,
  };
  return response;
}

/**
 * @function createSubFlats
 * @param {import("../types").ICreateSubFlats} data - Base Sub flat data
 * @param {string} propertyId - Current Admin's Property Id
 * @returns {Promise<null>}
 * @description Function to create sub flat
 */
async function createSubFlats(data, propertyId) {
  const reference = "createSubFlats";

  const subFlatNames = data.subFlats.map(({ name_en }) => name_en);

  const [flat, findSubFlats] = await Promise.all([
    getFlatWithBuilding({
      id: data.flatId,
      "$building.propertyId$": propertyId,
    }),
    SubFlat.findAll({
      where: {
        name_en: { [Op.in]: subFlatNames },
        flatId: data.flatId,
      },
    }),
  ]);

  if (!flat) {
    throw new AppError(reference, "Flat not found", "custom", 404);
  }

  if (!isArrayEmpty(findSubFlats)) {
    throw new AppError(
      reference,
      "Some of the mentioned Sub unit already exists",
      "custom",
      412
    );
  }

  await SubFlat.bulkCreate(
    data.subFlats.map((subFlat) => {
      return { ...subFlat, flatId: data.flatId };
    })
  ).catch((err) => {
    if (err instanceof db.Sequelize.ValidationError) {
      let msg = "";
      const errArrLength = err.errors.length;
      err.errors.forEach(({ path, message }, index) => {
        msg += `${index === errArrLength - 1 ? message : path + ", "}`;
      });
      throw new AppError(reference, msg, "custom", 412);
    }
    throw err;
  });

  return null;
}

async function getSubFlatByIdForAdmin({ subFlatId, propertyId }) {
  const reference = "getSubFlatByIdForAdmin";
  const subFlat = await SubFlat.findOne({
    where: { id: subFlatId, "$flat->building.propertyId$": propertyId },
    include: [
      {
        model: Flat,
        as: "flat",
        attributes: ["id", "name_en"],
        required: true,
        include: [
          {
            model: Building,
            as: "building",
            required: true,
            attributes: ["id", "name_en"],
          },
        ],
      },
    ],
    attributes: {
      exclude: ["flatId"],
    },
  });
  if (!subFlat) {
    throw new AppError(reference, "Sub Flat not found", "custom", 404);
  }
  return subFlat;
}

/**
 * @async
 * @function deleteSubFlat
 * @param {object} params
 * @param {string} params.subFlatId
 * @param {string} params.propertyId
 * @returns {Promise<null>}
 * @description Function to delete a sub flat
 */
async function deleteSubFlat({ subFlatId, propertyId }) {
  const reference = "deleteSubFlat";
  const subFlat = await getSubFlatFromParamsAndPropertyId({
    params: { id: subFlatId },
    propertyId,
  });
  if (!subFlat) {
    throw new AppError(reference, "Sub Flat not found", "custom", 404);
  }
  //TODO: check if there is any active contract against this Sub flat before deleting
  await subFlat.destroy();
  return null;
}

async function updateSubFlat({ subFlatId, propertyId, ...data }) {
  const reference = "updateSubFlat";
  const subFlat = await getSubFlatFromParamsAndPropertyId({
    params: { id: subFlatId },
    propertyId,
  });
  if (!subFlat) {
    throw new AppError(reference, "Sub Flat not found", "custom", 404);
  }
  if (data.flatId) {
    const flat = await getFlatWithBuilding({
      id: data.flatId,
      "$building.propertyId$": propertyId,
    });

    if (!flat) {
      throw new AppError(reference, "Flat not found", "custom", 404);
    }
  }
  const updatedSubFlatParams = {
    id: { [Op.ne]: subFlat.id },
    name_en: data.name_en ? data.name_en : subFlat.name_en,
    flatId: data.flatId ? data.flatId : subFlat.flatId,
  };

  if (await getSubFlat(updatedSubFlatParams)) {
    throw new AppError(
      reference,
      "Sub Unit with mentioned Name already exists",
      "custom",
      412
    );
  }

  for (const key in data) {
    subFlat[key] = data[key];
  }
  await subFlat.save();
  return null;
}

/**
 * @async
 * @function getSubFlatsForDropDown
 * @param {object} params
 * @param {string} params.propertyId
 * @param {string | undefined} params.flatId
 * @returns {Promise<object[]>}
 * @description Function to get complete list of sub flats in a property
 */
async function getSubFlatsForDropDown(params) {
  const subFlatParams = {
    "$flat->building.propertyId$": params.propertyId,
  };
  if (params.flatId) {
    subFlatParams["flatId"] = params.flatId;
  }

  const attributes = ["id", "name_en"];

  return await SubFlat.findAll({
    where: subFlatParams,
    attributes,
    order: [["name_en", "ASC"]],
    include: [
      {
        model: Flat,
        as: "flat",
        required: true,
        attributes: [],
        include: [
          {
            model: Building,
            as: "building",
            required: true,
            attributes: [],
          },
        ],
      },
    ],
  });
}

/**
 * @async
 * @function getVacantSubFlats
 * @param {object} params
 * @param {string} params.propertyId
 * @param {string | undefined} params.flatId
 * @returns {Promise<object[]>}
 * @description Function to get vacant flats
 */
async function getVacantSubFlats(params) {
  let vacantSubFlatsQuery = `
    SELECT sf.id, sf.name_en FROM sub_flats sf
    JOIN flats f ON (f.id = sf."flatId" AND f."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL)
    LEFT JOIN (
      SELECT l.id, l."subFlatId", ls.status FROM leases l
      JOIN (
        SELECT DISTINCT ON("leaseId") "leaseId", status FROM lease_statuses
        WHERE "deletedAt" IS NULL ORDER BY "leaseId", "createdAt" DESC
      ) ls ON (ls."leaseId" = l.id)
      WHERE l."deletedAt" IS NULL AND l."subFlatId" IS NOT NULL
    ) lws ON (lws."subFlatId" = sf.id)
    WHERE sf."deletedAt" IS NULL AND b."propertyId" = :propertyId
    AND (lws.id IS NULL OR lws.status IN (:statuses))`;

  if (params.flatId) {
    vacantSubFlatsQuery += ` AND sf."flatId" = :flatId`;
  }

  return await db.sequelize.query(vacantSubFlatsQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    replacements: {
      propertyId: params.propertyId,
      flatId: params.flatId,
      statuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
    },
  });
}

async function getSubFlatsForAdminExport(
  {
    propertyId,
    flatId,
    search,
    buildingId,
    status,
    flatType,
    ownerIds,
    furnishing,
    flatIds,
    rentalType,
  },
  { offset, limit }
) {
  const subFlatsQuery = `
    SELECT sf."subFlatId", sf.name_en as name, sf.size, sf.furnishing, sf."rentalType", sf."description",
    f.name_en AS "flat.name", b.name_en AS "flat.building.name",
     case
      when l.status = :activeLeaseStatus then '${CONTRACT_STATUSES.ACTIVE}'
      when l.id is null then ''
      else '${CONTRACT_STATUSES.IN_ACTIVE}'
    end as "leaseStatus",
     case
      when l.status = :activeLeaseStatus then '${FLAT_STATUSES.OCCUPIED}'
      else '${FLAT_STATUSES.VACANT}'
    end as "subFlatStatus"
     FROM sub_flats sf
    JOIN flats f ON (f.id = sf."flatId" AND f."deletedAt" IS NULL)
    left join (
          select distinct on(l1."subFlatId") l1.id, l1."subFlatId", ls.status from leases l1
          join lease_statuses ls on (ls."leaseId" = l1.id AND ls."deletedAt" is null)
          where l1."deletedAt" is null order by l1."subFlatId"  desc ,l1."createdAt" desc, ls."createdAt" desc
        ) l on (l."subFlatId" = sf.id)
    JOIN buildings b ON (b.id = f."buildingId" AND b."propertyId" = :propertyId)
    WHERE sf."deletedAt" IS NULL ${flatId ? `AND sf."flatId" = :flatId` : ``} 
    ${buildingId ? `AND b."id" = :buildingId` : ""}
      ${
        search
          ? `AND (
      sf.name_en ILIKE '%${search}%'
      OR f.name_en ILIKE '%${search}%'
      OR b.name_en ILIKE '%${search}%'
      OR sf.furnishing ILIKE '%${search}%'
      OR sf."subFlatId"::VARCHAR ILIKE '%${search}%'
      OR sf.size ILIKE '%${search}%'
      )`
          : ""
      }
          ${
            status
              ? `AND ${
                  status === LEASE_STATUSES.ACTIVE
                    ? `l.status = :activeLeaseStatus`
                    : `(l.id is null or l.status in (:inActiveLeaseStatuses))`
                } `
              : ``
          } 
  ${flatType ? `AND  f."flatType" = '${flatType}'` : ``} 
  ${ownerIds ? `AND f."ownerId" in (:ownerIds)` : ``}
  ${furnishing ? `AND sf."furnishing" = '${furnishing}'` : ``}
  ${flatIds ? `AND f.id in (:flatIds)` : ``}
  ${rentalType ? `AND sf."rentalType" = '${rentalType}'` : ``} 
    ORDER BY sf."createdAt" DESC, sf.name_en DESC LIMIT :limit OFFSET :offset`;

  const queryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId,
      flatId,
      buildingId,
      ownerIds,
      flatIds,
      activeLeaseStatus: LEASE_STATUSES.ACTIVE,
      inActiveLeaseStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      offset,
      limit,
    },
  };

  return await db.sequelize.query(subFlatsQuery, queryConfig);
}

module.exports = {
  getSubFlatsForAdmin,
  createSubFlats,
  getSubFlatByIdForAdmin,
  deleteSubFlat,
  updateSubFlat,
  getSubFlatsForDropDown,
  getVacantSubFlats,
  getSubFlatsForAdminExport,
};
