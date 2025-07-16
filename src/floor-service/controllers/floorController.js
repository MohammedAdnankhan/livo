const { LANGUAGES, LEASE_STATUSES } = require("../../config/constants");
const db = require("../../database");

async function getFloors({ buildingId }) {
  return db.sequelize.query(
    `select "floor" from flats 
     WHERE "buildingId"=:buildingId and "deletedAt" is NULL and "floor" is not null group by "floor" 
     order by case 
      WHEN "floor" ~ '^[0-9]+$' then "floor"::integer
      ELSE (select count(*) from flats)
    END asc`,
    {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        buildingId,
      },
    }
  );
}

async function getFloorsWithFlats(params, language = LANGUAGES.EN) {
  const query = `
    select f.id, f.size, f.name_${language} as name, f.floor, 
    case when u.id is null then 'Vacant' else null end as "flatStatus"
    from flats f
    left join users u on u."flatId" = f.id and u."familyMemberId" is null and u."deletedAt" is null
    where f."buildingId" = :buildingId
    and f."deletedAt" is null
    ${params.search ? `and f.name_${language} ilike '%${params.search}%'` : ""}
    ${params.floor ? `and f.floor = '${params.floor}'` : ""}
    order by floor, f.name_${language}
  `;

  const flats = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId: params.buildingId,
    },
  });

  const floorWithNestedFlats = {};

  flats.forEach((flat) => {
    if (!floorWithNestedFlats.hasOwnProperty(flat.floor)) {
      floorWithNestedFlats[flat.floor] = [flat];
    } else {
      floorWithNestedFlats[flat.floor].push(flat);
    }
  });

  return floorWithNestedFlats;
}

async function getFlatsWithStatus(params, language = LANGUAGES.EN) {
  const query = `
    select f.id, f.size, f.name_${language} as name, f.floor, 
    case when u.id is null then 'Vacant' else null end as "flatStatus"
    from flats f
    left join users u on u."flatId" = f.id and u."familyMemberId" is null and u."deletedAt" is null
    where f."buildingId" = :buildingId
    and f."deletedAt" is null
    ${params.search ? `and f.name_${language} like '%${params.search}%'` : ""}
    order by case 
      WHEN f."floor" ~ '^[0-9]+$' then f."floor"::integer
      ELSE (select count(*) from flats)
    END, case when f.name_en ~ '^[0-9]+$' then f.name_en::integer
      ELSE (select count(*) from flats) end asc
  `;

  const flats = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId: params.buildingId,
    },
  });

  return flats;
}

async function getVacantFlats(params, language = LANGUAGES.EN) {
  const query = `
    SELECT f.id, f.size, f.name_${language} AS name, f.floor FROM flats f
    LEFT JOIN (
      SELECT DISTINCT ON(l1."flatId") l1.id, l1."flatId", ls.status from leases l1
      JOIN lease_statuses ls ON (ls."leaseId" = l1.id AND ls."deletedAt" IS NULL)
      WHERE l1."deletedAt" IS NULL ORDER BY l1."flatId", l1."createdAt" DESC, ls."createdAt" DESC
    ) l ON (l."flatId" = f.id)
    WHERE f."buildingId" = :buildingId AND f."deletedAt" IS NULL
    AND (l.id IS NULL OR l.status IN (:inActiveLeaseStatuses))
    ${params.search ? `AND f.name_${language} LIKE '%${params.search}%'` : ""}
    order by floor, f.name_${language}
  `;
  return await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId: params.buildingId,
      inActiveLeaseStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
    },
  });
}

module.exports = {
  getFloorsWithFlats,
  getFloors,
  getFlatsWithStatus,
  getVacantFlats,
};
