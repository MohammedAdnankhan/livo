const { LEASE_STATUSES } = require("../../config/constants");
const db = require("../../database");
const Lease = require("../models/Lease");
const moment = require("moment-timezone");

module.exports.getUserTypeCount = async (params) => {
  const query = `SELECT "userType", COUNT(*)::INTEGER AS "count"
FROM (
  select mu.id,
  case 
    when l.id is not null and fo."ownedFlats" is not null and l.status in (:activeStatuses) and  l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) > now() then 'Residing Owners'
    when l.id is not null and fo."ownedFlats" is null and l.status in (:activeStatuses) and l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) > now() then 'Residents'
    when (l.id is null or l.status in (:inActiveStatuses) or l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)< now()) and fo."ownedFlats" is not null then 'Owners'
    else 'New Users' end as "userType"
  from master_users mu
   LEFT JOIN (
      SELECT DISTINCT ON(l1."masterUserId") l1.id, l1."masterUserId", l1."flatId", ls.status, l1."startDate", l1."endDate",l1."discount" FROM leases l1
      JOIN lease_statuses ls ON (ls."leaseId" = l1.id AND ls."deletedAt" IS NULL)
      WHERE l1."deletedAt" IS NULL ORDER BY l1."masterUserId", l1."createdAt" DESC, ls."createdAt" DESC
    ) l ON (l."masterUserId" = mu.id)
  left join flats f on (f.id = l."flatId" and f."deletedAt" is null)
  left join buildings b on (b.id = f."buildingId" and b."deletedAt" is null )
   LEFT JOIN (
      SELECT count(*)::INTEGER AS "ownedFlats", "ownerId" FROM flats WHERE "deletedAt" IS NULL GROUP BY "ownerId"
    ) fo on (fo."ownerId" = mu.id)
  WHERE mu."deletedAt" IS NULL AND mu."propertyId" = :propertyId ${
    params.buildingId ? `AND f."buildingId" = '${params.buildingId}'` : ""
  } AND mu."createdAt" between :startDate and :endDate
) AS "ownerTypeQuery"
GROUP BY "userType"`;

  const userType = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      startDate: params.startDate,
      endDate: params.endDate,
      inActiveStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      activeStatuses: new Array(LEASE_STATUSES.ACTIVE),
    },
  });
  let userCountParams = {
    "Residing Owners": 0,
    Residents: 0,
    Owners: 0,
    "New Users": 0,
  };
  userType.forEach((userCount) => {
    userCountParams[userCount.userType] = userCount.count;
  });
  return userCountParams;
};

module.exports.leaseStats = async ({ propertyId, buildingId }) => {
  const previousStartDateOfMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousEndDateOfMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .toDate();

  const totalLeasesCountQuery = `
  select count(*)::INTEGER from leases l
  join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on ls."leaseId" = l.id
  LEFT JOIN flats f on (l."flatId"= f.id and f."deletedAt" is null)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  join buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  where b."propertyId" = :propertyId and ls.status in (:statuses) and l."deletedAt" is null
  ${buildingId ? `and b.id='${buildingId}'` : ""}
  `;
  const previousMonthLeasesQuery =
    totalLeasesCountQuery +
    `and ls."createdAt"  between :startDate and :endDate`;

  const [
    activeContracts,
    // perviousActiveContracts,
    expiredContracts,
    // previousExpiredContracts,
    newContracts,
    // perviousNewContracts,
  ] = await Promise.all([
    await db.sequelize.query(totalLeasesCountQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        statuses: new Array(LEASE_STATUSES.ACTIVE),
      },
    }),
    // await db.sequelize.query(previousMonthLeasesQuery, {
    //   raw: true,
    //   type: db.Sequelize.QueryTypes.SELECT,
    //   replacements: {
    //     propertyId,
    //     statuses: new Array(LEASE_STATUSES.ACTIVE),
    //     startDate: previousStartDateOfMonth,
    //     endDate: previousEndDateOfMonth,
    //   },
    // }),
    await db.sequelize.query(totalLeasesCountQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        statuses: new Array(LEASE_STATUSES.EXPIRED),
      },
    }),
    // await db.sequelize.query(previousMonthLeasesQuery, {
    //   raw: true,
    //   type: db.Sequelize.QueryTypes.SELECT,
    //   replacements: {
    //     propertyId,
    //     statuses: new Array(LEASE_STATUSES.EXPIRED),
    //     startDate: previousStartDateOfMonth,
    //     endDate: previousEndDateOfMonth,
    //   },
    // }),
    await db.sequelize.query(totalLeasesCountQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        statuses: new Array(LEASE_STATUSES.DRAFT),
      },
    }),
    // await db.sequelize.query(previousMonthLeasesQuery, {
    //   raw: true,
    //   type: db.Sequelize.QueryTypes.SELECT,
    //   replacements: {
    //     propertyId,
    //     statuses: new Array(LEASE_STATUSES.DRAFT),
    //     startDate: previousStartDateOfMonth,
    //     endDate: previousEndDateOfMonth,
    //   },
    // }),
  ]);
  //TODO: have to add renewed contracts in this api
  const responseObj = {
    active: {
      total: activeContracts[0].count,
      // previousMonth: perviousActiveContracts[0].count,
    },
    renewed: {
      total: 0,
      // previousMonth: 0,
    },
    expired: {
      total: expiredContracts[0].count,
      // previousMonth: previousExpiredContracts[0].count,
    },
    draft: {
      total: newContracts[0].count,
      // previousMonth: perviousNewContracts[0].count,
    },
  };

  return responseObj;
};

module.exports.getOccupiedFlatCountForUnitStat = async (
  startDate,
  endDate,
  propertyId,
  buildingId
) => {
  // startDate = new Date(startDate);
  // endDate = new Date(endDate);
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  let result;
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  const timeFormat = "HH24:MI";

  if (timeDifference <= oneDay) {
    const query = `SELECT COUNT(*) AS count,
       TO_CHAR(DATE_TRUNC('hour', ls."createdAt"::timestamp)
       - (DATE_PART('hour', ls."createdAt"::timestamp)::integer % 3) * interval '1 hour', :timeFormat )
       || '-'
       || TO_CHAR(DATE_TRUNC('hour', ls."createdAt"::timestamp)
       - (DATE_PART('hour', ls."createdAt"::timestamp)::integer % 3) * interval '1 hour' + interval '3 hours', :timeFormat) AS date_time_range
FROM leases l
join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on ls."leaseId" = l.id
INNER JOIN "flats" AS f ON (l."flatId" = f.id and f."deletedAt" is NULL)
INNER JOIN "buildings" AS b ON (f."buildingId" = b.id  AND b."deletedAt" is null )
 where ls."status" = '${
   LEASE_STATUSES.ACTIVE
 }' and l."deletedAt" is null and  b."propertyId" = '${propertyId}' ${
      buildingId ? `AND f."buildingId"='${buildingId}'` : ""
    } and ls."createdAt" between  :startDate AND   :endDate and l."deletedAt" is null
GROUP BY date_time_range
ORDER BY date_time_range ASC;`;

    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
        timeFormat,
      },
    });
  } else if (timeDifference <= oneWeek) {
    const query = `SELECT
 CASE
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 0 THEN 'Sun'
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 1 THEN 'Mon'
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 2 THEN 'Tue'
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 3 THEN 'Wed'
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 4 THEN 'Thu'
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 5 THEN 'Fri'
    WHEN EXTRACT(DOW FROM ls."createdAt"::timestamp AT TIME ZONE 'UTC') = 6 THEN 'Sat'
  END AS day_of_week,

  COUNT(*) AS count
FROM leases l
join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on ls."leaseId" = l.id
INNER JOIN "flats" AS f ON (l."flatId" = f.id AND "f"."deletedAt" IS NULL)
INNER JOIN "buildings" AS b ON (f."buildingId" = b.id AND  b."deletedAt" is null  )
WHERE
  l."deletedAt" is null AND b."propertyId" = '${propertyId}'
  ${buildingId ? `AND f."buildingId"='${buildingId}'` : ""}
  AND ls."status" = '${LEASE_STATUSES.ACTIVE}' 
  AND ls."createdAt" BETWEEN :startDate AND :endDate
GROUP BY
  day_of_week
ORDER BY
  day_of_week ASC;
`;
    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
      },
    });
  } else if (timeDifference <= thirtyDays) {
    const query = `SELECT
  COUNT(*) AS count,
  TO_CHAR(DATE_TRUNC('week', ls."createdAt"::timestamp AT TIME ZONE 'UTC'), 'MM/DD')
  || '-'
  || TO_CHAR(DATE_TRUNC('week', ls."createdAt"::timestamp AT TIME ZONE 'UTC') + INTERVAL '6 days', 'MM/DD') AS week_date_range
  FROM leases l 
  join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on ls."leaseId" = l.id
  INNER JOIN "flats" AS f ON (l."flatId" = f.id AND "f"."deletedAt" IS NULL)
  INNER JOIN "buildings" AS b ON ( f."buildingId" = b.id AND b."deletedAt" is null)
 where ls."status" = '${
   LEASE_STATUSES.ACTIVE
 }'  and b."propertyId" = '${propertyId}'  ${
      buildingId ? `AND f."buildingId"='${buildingId}'` : ""
    } and l."deletedAt" is null  and ls."createdAt"  between  :startDate AND  :endDate
GROUP BY
  week_date_range
ORDER BY
  week_date_range ASC`;

    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        startDate,
        endDate,
      },
    });
  } else {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    const monthsInRange = [];
    const params = {};
    if (propertyId) {
      params.propertyId = propertyId;
    }
    if (buildingId) {
      params.id = buildingId;
    }

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 0;
      const monthEnd = year === endYear ? endMonth : 11;

      for (let month = monthStart; month <= monthEnd; month++) {
        monthsInRange.push({ year, month: month + 1 });
      }
    }
    const rawQuery = `
  SELECT
    EXTRACT(YEAR FROM ls."createdAt") AS "year",
    EXTRACT(MONTH FROM ls."createdAt") AS "month",
    COUNT("l"."flatId") AS "flatsOccupied"
  FROM "leases" l
   join(
    select distinct on("leaseId") * from lease_statuses 
    where "deletedAt" is null 
    order by "leaseId", "createdAt" desc
  ) ls
  on ls."leaseId" = l.id
  INNER JOIN "flats" AS f ON (l."flatId" = f."id" and f."deletedAt" is null)
  INNER JOIN "buildings" AS b ON (f."buildingId" = b."id" and b."deletedAt" is null)
  where
  ls."status" = '${
    LEASE_STATUSES.ACTIVE
  }'  AND b."propertyId" = '${propertyId}'  
   ${
     buildingId ? `AND f."buildingId"='${buildingId}'` : ""
   } AND l."deletedAt" is null  and ls."createdAt"  between  :startDate AND  :endDate
  GROUP BY "year", "month";
`;

    const occupiedFlats = await db.sequelize.query(rawQuery, {
      replacements: { startDate, endDate },
      type: db.sequelize.QueryTypes.SELECT,
      raw: true,
    });
    const flatsMap = new Map();
    occupiedFlats.forEach((occupiedFlat) => {
      const year = occupiedFlat.year;
      const month = occupiedFlat.month;
      flatsMap.set(`${year}-${month}`, occupiedFlat);
    });

    result = monthsInRange.map(({ year, month }) => {
      const key = `${year}-${month}`;
      const flatData = flatsMap.get(key) || { year, month, flatsOccupied: 0 };
      return flatData;
    });
  }
  return result;
};
