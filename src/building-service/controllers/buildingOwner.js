const { LANGUAGES } = require("../../config/constants");
const db = require("../../database");

//TODO: REMOVE FLAT CONTRACTS MAPPING
async function getOwnerBuildings(
  { search, ownerId },
  { offset, limit },
  language = LANGUAGES.EN
) {
  const buildingsCountQuery = `
    SELECT COUNT(DISTINCT(b.id))::INTEGER FROM buildings b
    JOIN localities l ON (l.id = b."localityId" AND l."deletedAt" IS NULL)
    JOIN flats f ON (f."buildingId" = b.id AND f."deletedAt" IS NULL AND f."ownerId" = :ownerId)
    WHERE b."deletedAt" IS NULL ${
      search
        ? `AND (
      b.name_${language} ILIKE '%${search}%' OR
      l.name_${language} ILIKE '%${search}%' OR
      b."buildingType" ILIKE '%${search}%'
      )`
        : ""
    }`;

  const buildingsDataQuery = `
    SELECT DISTINCT(b.id), b.name_${language} AS name, b."buildingType", 
    jsonb_build_array(b.images) AS images, l.name_${language} AS "locality.name",
    CASE WHEN tf."totalFlats" IS NULL THEN 0 ELSE tf."totalFlats" END AS "totalFlats",
    CASE WHEN vf."vacantFlats" IS NULL THEN 0 ELSE vf."vacantFlats" END AS "vacantFlats"
    FROM buildings b
    JOIN localities l ON (l.id = b."localityId" AND l."deletedAt" IS NULL)
    JOIN flats f ON (f."buildingId" = b.id AND f."deletedAt" IS NULL)
    LEFT JOIN (
      SELECT COUNT(*)::INTEGER AS "totalFlats", "buildingId" 
      FROM flats WHERE "deletedAt" IS NULL AND "ownerId" = :ownerId
      GROUP BY "buildingId"
    ) tf ON (f."buildingId" = tf."buildingId")
    LEFT JOIN (
      SELECT COUNT(f.id)::INTEGER AS "vacantFlats", f."buildingId" FROM flats f 
      LEFT JOIN (
        SELECT DISTINCT ON("flatId") * FROM flat_contracts 
        WHERE "deletedAt" IS NULL
        ORDER BY "flatId", "createdAt" DESC
      ) fc ON (fc."flatId" = f.id)
      WHERE f."deletedAt" IS NULL AND f."ownerId" = :ownerId
      AND (fc.id IS NULL OR fc."isValid" IS false OR fc."contractEndDate" + INTERVAL '1 month' * fc.grace < NOW())
      group by f."buildingId"
    ) vf on (vf."buildingId" = f."buildingId")
    WHERE b."deletedAt" IS NULL AND f."ownerId" = :ownerId ${
      search
        ? `AND (
      b.name_${language} ILIKE '%${search}%' OR
      l.name_${language} ILIKE '%${search}%' OR
      b."buildingType" ILIKE '%${search}%'
      )`
        : ""
    } ORDER BY b.name_${language} ASC LIMIT :limit OFFSET :offset`;

  const [[{ count }], buildings] = await Promise.all([
    db.sequelize.query(buildingsCountQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      replacements: {
        ownerId,
      },
    }),
    db.sequelize.query(buildingsDataQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        ownerId,
        limit,
        offset,
      },
    }),
  ]);

  buildings.forEach((building) => {
    const { images } = building;
    building.images = images[0];
  }); //TODO: could optimize at DB layer itself

  return { count, data: buildings };
}

//TODO: REMOVE FLAT CONTRACTS MAPPING
async function getBuildingForOwner(
  { buildingId, flatIds, ownerId },
  language = LANGUAGES.EN
) {
  const ownerBuildingQuery = `
    SELECT b.id, b.name_${language} AS name, b."buildingType", b.address_en AS "address", b."governmentPropertyId",
    b.images, b.documents, b.description_${language} AS description, b."primaryContact", l.name_${language} AS "locality.name",
    ARRAY(
      SELECT f.name_${language} FROM flats f
      LEFT JOIN (
        SELECT DISTINCT ON("flatId") * FROM flat_contracts WHERE "deletedAt" IS NULL AND "flatId" IN (:flatIds)
        ORDER BY "flatId", "createdAt" DESC
      ) fc ON (fc."flatId" = f.id)
      WHERE f."deletedAt" IS NULL AND (fc.id IS NULL OR fc."isValid" IS false OR fc."contractEndDate" + INTERVAL '1 month' * fc.grace < NOW())
      AND f."ownerId" = :ownerId AND f."buildingId" = :buildingId
    ) AS "vacantFlats",
    ARRAY(
      SELECT f1.name_${language} FROM flats f1
      JOIN (
        SELECT DISTINCT ON("flatId") * FROM flat_contracts WHERE "deletedAt" IS NULL AND "flatId" IN (:flatIds)
        ORDER BY "flatId", "createdAt" DESC
      ) fc1 ON (fc1."flatId" = f1.id AND fc1."isValid" IS true AND fc1."contractEndDate" + INTERVAL '1 month' * fc1.grace > NOW())
      WHERE f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId AND f1."buildingId" = :buildingId
    ) AS "occupiedFlats" FROM buildings b JOIN localities l ON (l.id = b."localityId" AND l."deletedAt" IS NULL)
    WHERE b."deletedAt" IS NULL AND b.id = :buildingId`;

  const [building] = await db.sequelize.query(ownerBuildingQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      ownerId,
      buildingId,
      flatIds,
    },
  });

  return building;
}

module.exports = { getOwnerBuildings, getBuildingForOwner };
