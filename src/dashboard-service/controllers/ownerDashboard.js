const db = require("../../database");

//TODO: REMOVE FLAT CONTRACTS MAPPING
const getStatistics = async ({ buildingId, buildings, ownerId }) => {
  const requestQuery = `
    SELECT
    COUNT (*)::INTEGER
    FROM maintenance_requests mr 
    JOIN flats f ON f."id" = mr."flatId" and (f."deletedAt" IS NULL)
    WHERE mr."deletedAt" IS NULL AND mr."flatId" in (:flatIds) `;

  const tenantsCountQuery = `
    SELECT COUNT(mu.id)::INTEGER FROM master_users mu
    JOIN (
      SELECT DISTINCT ON(fc1."masterUserId") * FROM flat_contracts fc1
      JOIN flats f1 ON (f1.id = fc1."flatId" AND f1."deletedAt" IS NULL AND f1."ownerId" = :ownerId)
      WHERE fc1."deletedAt" IS NULL
      ORDER BY fc1."masterUserId", fc1."createdAt" DESC
    ) AS fc ON (fc."masterUserId" = mu.id AND (fc."contractEndDate" + INTERVAL '1 month' * fc."grace" > NOW()) AND fc."isValid" IS true)
    JOIN flats f ON (f.id = fc."flatId" AND f."deletedAt" IS NULL AND f."id" in (:flatIds))
    WHERE mu."deletedAt" IS NULL`;

  const activeLeasesCountQuery = `
    SELECT count("FlatContract"."id") ::INTEGER
      FROM 
        "flat_contracts" AS "FlatContract" 
        INNER JOIN "flats" AS "flat" ON "FlatContract"."flatId" = "flat"."id" 
        AND ("flat"."deletedAt" IS NULL AND "flat"."ownerId"= :ownerId AND flat."id" in (:flatIds)) 
        WHERE 
          (
            "FlatContract"."deletedAt" IS NULL 
            AND "FlatContract"."isValid" is TRUE 
            AND (
              (
                "FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace"
              ) > now()
            )
          )`;

  const expiredLeasesCountQuery = `
    SELECT count("FlatContract"."id")::INTEGER
      FROM 
        "flat_contracts" AS "FlatContract" 
        INNER JOIN "flats" AS "flat" ON "FlatContract"."flatId" = "flat"."id" 
        AND ("flat"."deletedAt" IS NULL AND "flat"."ownerId"= :ownerId AND flat."id" in (:flatIds)) 
      WHERE 
        (
          "FlatContract"."deletedAt" IS NULL 
          AND (
            (
              DATE(
                "FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace"
              ) < now()
            ) 
            or (
              "isValid" = false 
            )
          )
        )`;

  let flatIds = buildings.flatMap(({ flats }) => flats.map(({ id }) => id));
  let flatCount = flatIds.length;
  let buildingIds = buildings.map(({ id }) => id);
  if (buildingId) {
    const building = [buildings.find((obj) => obj.id === buildingId)];
    flatIds = building.flatMap(({ flats }) => flats.map(({ id }) => id));
    buildingIds = [building[0].id];
    flatCount = building[0].flats.length;
  }

  const [totalRequests, totalTenants, activeLeases, expiredLeases] =
    await Promise.all([
      db.sequelize.query(requestQuery, {
        type: db.Sequelize.QueryTypes.SELECT,
        raw: true,
        nest: true,
        replacements: {
          flatIds,
        },
      }),
      db.sequelize.query(tenantsCountQuery, {
        type: db.Sequelize.QueryTypes.SELECT,
        raw: true,
        nest: true,
        replacements: {
          flatIds,
          ownerId,
        },
      }),
      db.sequelize.query(activeLeasesCountQuery, {
        type: db.Sequelize.QueryTypes.SELECT,
        raw: true,
        nest: true,
        replacements: {
          flatIds,
          ownerId,
        },
      }),
      db.sequelize.query(expiredLeasesCountQuery, {
        type: db.Sequelize.QueryTypes.SELECT,
        raw: true,
        nest: true,
        replacements: {
          flatIds,
          ownerId,
        },
      }),
    ]);

  return {
    totalRequestCount: totalRequests[0].count,
    totalBuildings: buildingIds.length,
    totalTenants: totalTenants[0].count,
    activeLeases: activeLeases[0].count,
    expiredLeases: expiredLeases[0].count,
    flats: flatCount,
  };
};
module.exports = { getStatistics };
