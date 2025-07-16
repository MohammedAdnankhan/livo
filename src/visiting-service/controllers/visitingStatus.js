const { Op } = require("sequelize");
const { getBuildings } = require("../../building-service/controllers/building");
const {
  VISITOR_STATUSES,
  ACTION_TYPES,
  SOURCE_TYPES,
  VISITOR_STATS_BIFURCATION_TYPES,
} = require("../../config/constants");
const Flat = require("../../flat-service/models/Flat");
const { AppError } = require("../../utils/errorHandler");
const eventEmitter = require("../../utils/eventEmitter");
const VisitorVisiting = require("../models/VisitorVisiting");
const VisitorVisitingStatus = require("../models/VisitorVisitingStatus");
const VALID_STATUSES = Object.values(VISITOR_STATUSES);
const db = require("../../database");
const moment = require("moment-timezone");

function getVisitingWithFlatDetails(params, transaction) {
  return VisitorVisiting.findOne(
    {
      where: params,
      include: { model: Flat, as: "flat" },
    },
    transaction
  );
}

async function validateGuardIdForVisiting(
  { visitingId, guardBuildingId },
  transaction = null
) {
  const visitingDetails = await getVisitingWithFlatDetails(
    { id: visitingId },
    transaction
  );

  if (!visitingDetails)
    throw new AppError(
      "validateGuardIdForVisiting",
      "Invalid Body",
      "custom",
      200,
      [
        {
          column: "visitingId",
          message: "Invalid Visisting Id",
        },
      ]
    );
  //TODO: guardbuildingId validation is missing
  if (visitingDetails.flat.buildingId !== guardBuildingId)
    throw new AppError(
      "validateGuardIdForVisiting",
      "You are not authorised to perform this action",
      "custom",
      403
    );

  return visitingDetails;
}

async function updateVisitingStatus(data, transaction = null) {
  const { status, visitingId, guardId, flatId } = data;

  if (!VALID_STATUSES.includes(status))
    throw new AppError("updateVisitingStatus", "Invalid Body", "custom", 200, [
      {
        column: "status",
        message: `Status can only be ${VALID_STATUSES.join(", ")}`,
      },
    ]);

  const currentStatus = await getCurrentStatus(visitingId);

  if (currentStatus && currentStatus.status === status) {
    throw new AppError("updateVisitingStatus", "Invalid Body", "custom", 200, [
      {
        column: "status",
        message: `You can't set same status again`,
      },
    ]);
  }

  const visitingStatus = await VisitorVisitingStatus.create(
    {
      status,
      visitingId,
      guardId,
    },
    { transaction }
  );

  if (status === VISITOR_STATUSES.CHECKIN) {
    eventEmitter.emit("flat_level_notification", {
      actionType: ACTION_TYPES.ENTERED_BUILDING.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visitingId,
      generatedBy: guardId,
      flatId,
    });
  } else if (status === VISITOR_STATUSES.CHECKOUT) {
    eventEmitter.emit("flat_level_notification", {
      actionType: ACTION_TYPES.LEFT_BUILDING.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visitingId,
      generatedBy: guardId,
      flatId,
    });
  } else if (status === VISITOR_STATUSES.APPROVED) {
    eventEmitter.emit("flat_level_notification", {
      actionType: ACTION_TYPES.ENTRY_APPROVED.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visitingId,
      generatedBy: guardId,
      flatId,
    });
  } else if (guardId && status === VISITOR_STATUSES.DENIED) {
    eventEmitter.emit("flat_level_notification", {
      actionType: ACTION_TYPES.ENTRY_DENIED_BY_GUARD.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visitingId,
      generatedBy: guardId,
      flatId,
    });
  } else if (status === VISITOR_STATUSES.DENIED) {
    eventEmitter.emit("flat_level_notification", {
      actionType: ACTION_TYPES.ENTRY_DENIED.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visitingId,
      generatedBy: guardId,
      flatId,
    });
  }

  return visitingStatus;
}

async function getCurrentStatus(visitingId) {
  return await VisitorVisitingStatus.findOne({
    where: { visitingId },
    order: [["createdAt", "DESC"]],
  });
}

async function approvedOrDenyVisitor({ status, visitingId, userId, flatId }) {
  if (![VISITOR_STATUSES.APPROVED, VISITOR_STATUSES.DENIED].includes(status)) {
    throw new AppError("updateVisitingStatus", "Invalid Body", "custom", 200, [
      {
        column: "status",
        message: `Invalid Status`,
      },
    ]);
  }

  const lastStatus = await getCurrentStatus(visitingId);

  if (lastStatus.status != VISITOR_STATUSES.PENDING) {
    throw new AppError("updateVisitingStatus", "Invalid Body", "custom", 200, [
      {
        column: "status",
        message: `Visiting already approved/denied`,
        code: +"001",
      },
    ]);
  }

  await VisitorVisiting.update(
    { residentId: userId },
    {
      where: { id: visitingId },
    }
  );

  return await updateVisitingStatus({ status, visitingId, flatId });
}

async function getMoveinAndMoveoutCount(flatParams, { startDate, endDate }) {
  const params = {};

  if (startDate && endDate) {
    params.createdAt = {
      [Op.gte]: startDate,
      [Op.lte]: endDate,
    };
  } else if (startDate) {
    params.createdAt = {
      [Op.gte]: startDate,
    };
  } else if (endDate) {
    params.createdAt = {
      [Op.gte]: endDate,
    };
  }
  if (flatParams.buildingId) {
    flatParams = { buildingId: flatParams.buildingId };
  } else {
    let buildingsIds = [];
    const buildings = await getBuildings({ propertyId: flatParams.propertyId });
    buildings.map((building) => {
      buildingsIds.push(building.id);
    });
    flatParams = { buildingId: { [Op.in]: buildingsIds } };
  }

  const [moveIn, moveOut] = await Promise.all([
    VisitorVisitingStatus.count({
      where: {
        ...params,
        status: VISITOR_STATUSES.CHECKIN,
      },
      attributes: [],
      include: [
        {
          model: VisitorVisiting,
          as: "visiting",
          required: true,
          paranoid: false,
          include: {
            model: Flat,
            as: "flat",
            paranoid: false,
            where: flatParams,
            required: true,
          },
        },
      ],
      raw: true,
    }),
    VisitorVisitingStatus.count({
      where: {
        ...params,
        status: VISITOR_STATUSES.CHECKOUT,
      },
      attributes: [],
      include: [
        {
          model: VisitorVisiting,
          as: "visiting",
          required: true,
          attributes: [],
          paranoid: false,
          include: {
            model: Flat,
            as: "flat",
            attributes: [],
            paranoid: false,
            where: flatParams,
            required: true,
          },
        },
      ],
      raw: true,
    }),
  ]);

  return { moveIn, moveOut };
}

async function getVisitorVisitingsStatus(
  params,
  limit = 1,
  offset = 0,
  order = [["createdAt", "DESC"]]
) {
  return await VisitorVisitingStatus.findAll({
    where: params,
    order,
    limit,
    offset,
  });
}

async function autoCheckOutCron() {
  //get visitings that are checked in for more than 48 hours
  const query = `
  select vvs."visitingId" from (
    select distinct on("visitingId") * from visitor_visiting_statuses 
    where "deletedAt" is null 
    order by "visitingId", "createdAt" desc
    ) vvs 
    join visitor_visitings vv on vv.id = vvs."visitingId" and (vv."deletedAt" is null)
  where vvs.status = :status and round((EXTRACT(epoch FROM (:now - vvs."createdAt")))/3600) >= 48`;

  const visitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      status: VISITOR_STATUSES.CHECKIN,
      now: new Date(),
    },
  });

  let checkoutData = [...visitings];

  //add checkout status for the above visitings
  checkoutData.forEach(
    (visiting) => (visiting.status = VISITOR_STATUSES.CHECKOUT)
  );

  for (let visiting of checkoutData) {
    //get visiting details with flat
    const visitingQuery = `select "flatId" from visitor_visitings where "deletedAt" is null and id = :id`;

    const visitingDetails = (
      await db.sequelize.query(visitingQuery, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          id: visiting.visitingId,
        },
      })
    )[0];

    //add checkout status in the above visitings
    await VisitorVisitingStatus.create(visiting);

    //emit notifications for these
    eventEmitter.emit("flat_level_notification", {
      actionType: ACTION_TYPES.AUTO_CHECKOUT.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visiting.visitingId,
      generatedBy: null,
      flatId: visitingDetails.flatId,
    });
  }
  return {
    msg: `Checked out ${checkoutData.length} visitings`,
    visitings, //TODO: remove visitings from response
  };
}

async function getVisitingsCount({ buildingIds, startDate, endDate }) {
  const query = `
  select count(vvs.*) from visitor_visiting_statuses vvs 
  join visitor_visitings vv on (vv."id" = vvs."visitingId" and vv."deletedAt" is null) 
  join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds) and f."deletedAt" is null) 
  where vvs.status = :status and vvs."deletedAt" is null ${
    startDate ? 'and vvs."createdAt" >= :startDate' : ""
  }  and vvs."createdAt" <= :endDate`;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getVisitingsCountAnalytics({ buildingIds, startDate, endDate }) {
  const query = `
  select 
    COUNT(*)  as count
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = :status
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    join visitor_visitings vv on vv.id = vvs1."visitingId"
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)

    where f."buildingId" in (:buildingIds) and vv."deletedAt" is null
    ${
      startDate ? 'and vvs1."createdAt" >= :startDate' : ""
    }  and vvs1."createdAt" <= :endDate
	`;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getVisitingsCountFromLastStatus({
  buildingIds,
  status,
  startDate,
  endDate,
}) {
  const query = `
  select count(*) from (
    select distinct on("visitingId") * from visitor_visiting_statuses 
    order by "visitingId", "createdAt" desc
  ) vvs
  join visitor_visitings vv on (vv.id = vvs."visitingId" and vv."deletedAt" is null)
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null and f."buildingId" in (:buildingIds))
  where vvs.status = :status and vvs."createdAt" between :startDate and :endDate
  `;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getDeliveriesCount({ buildingIds, startDate, endDate }) {
  const query = `
  select count(vvs.*) from visitor_visiting_statuses vvs
  join visitor_visitings vv on (vv.id = vvs."visitingId" and vv."deletedAt" is null)
  join visitor_types vt on (vt.id = vv."visitorTypeId" and vt.category_en = :category)
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null and f."buildingId" in (:buildingIds))
  where vvs.status = :status and vvs."deletedAt" is null ${
    startDate ? 'and vvs."createdAt" >= :startDate' : ""
  }  and vvs."createdAt" <= :endDate`;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        category: "Delivery",
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getDeliveriesCountByCompany({
  buildingIds,
  startDate,
  endDate,
}) {
  const query = `
  select count(vvs.*)::INTEGER, vt.company_en as company from visitor_visiting_statuses vvs
  join visitor_visitings vv on (vv.id = vvs."visitingId" and vv."deletedAt" is null)
  join visitor_types vt on (vt.id = vv."visitorTypeId" and vt.category_en = :category)
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null and f."buildingId" in (:buildingIds))
  where vvs.status = :status and vvs."createdAt" between :startDate and :endDate
  group by company order by count desc`;
  let deliveryCount = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      status: VISITOR_STATUSES.CHECKIN,
      category: "Delivery",
      buildingIds,
      startDate,
      endDate,
    },
  });

  const othersCount = deliveryCount
    .filter((obj) => !obj.company || obj.company == "Others")
    .reduce((accumulator, obj) => accumulator + +obj.count, 0);

  deliveryCount = deliveryCount.filter(
    (obj) => obj.company && obj.company != "Others"
  );
  deliveryCount.push({ count: othersCount, company: "Others" });

  return deliveryCount;
}

async function getAverageVisitDurationByCategory({
  buildingIds,
  startDate,
  endDate,
}) {
  const query = `
  select vt.category_en as category, round(cast(extract(epoch from avg(vvs."visitDuration"))/3600 as numeric), 2) as "averageDuration" from (
    select "visitingId", max("createdAt") - min("createdAt") as "visitDuration" from visitor_visiting_statuses
    where status in (:statuses) and "createdAt" between :startDate and :endDate 
    group by "visitingId"
    having count("visitingId") = 2
  ) vvs
  join visitor_visitings vv on (vv.id = vvs."visitingId" and vv."deletedAt" is null)
  join visitor_types vt on vt.id = vv."visitorTypeId"
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null and f."buildingId" in (:buildingIds))
  group by vt.category_en`;

  return await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      statuses: new Array(VISITOR_STATUSES.CHECKIN, VISITOR_STATUSES.CHECKOUT),
      buildingIds,
      startDate,
      endDate,
    },
  });
}

async function getAverageVisitDuration({ buildingIds, startDate, endDate }) {
  const query = `
  select round(cast(extract(epoch from avg(vvs."visitDuration"))/3600 as numeric), 2) as "averageDuration" from (
    select "visitingId", max("createdAt") - min("createdAt") as "visitDuration" from visitor_visiting_statuses
    where status in (:statuses) and "createdAt" >= :startDate and "createdAt" <= :endDate 
    group by "visitingId"
    having count("visitingId") = 2
  ) vvs
  join visitor_visitings vv on (vv.id = vvs."visitingId" and vv."deletedAt" is null)
  join visitor_types vt on vt.id = vv."visitorTypeId"
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null and f."buildingId" in (:buildingIds))`;

  const avgVisitDuration = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      statuses: new Array(VISITOR_STATUSES.CHECKIN, VISITOR_STATUSES.CHECKOUT),
      buildingIds,
      startDate,
      endDate,
    },
  });
  return avgVisitDuration[0]?.averageDuration
    ? avgVisitDuration[0]?.averageDuration
    : 0;
}

const visitingOverviewGraph = async (
  startDate,
  endDate,
  bifurcationData,
  categoryId,
  categoryName,
  propertyId,
  buildingIds
) => {
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  const buildingIdsString = buildingIds.map((id) => `'${id}'`).join(", ");
  let totalVisitor, uniqueVisitors;
  if (timeDifference <= oneDay) {
    const query1 = `
      SELECT
      TO_CHAR(
      DATE_TRUNC('hour', vvs."createdAt"::timestamp)
      - (DATE_PART('hour', vvs."createdAt"::timestamp)::integer % 3) * interval '1 hour', 'HH24:MI')
      || '-'
      || TO_CHAR(
        DATE_TRUNC('hour', vvs."createdAt"::timestamp)
        - (DATE_PART('hour', vvs."createdAt"::timestamp)::integer % 3) * interval '1 hour' 
        + interval '3 hours', 'HH24:MI') AS date_time_range,
      COUNT(*) AS count
      FROM (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'  
      order by "visitingId", "createdAt" DESC
    ) as vvs
      JOIN visitor_visitings vv ON vv."id" = vvs."visitingId"
      JOIN visitor_types vt ON vt.id = vv."visitorTypeId"
      JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
      WHERE ${
        buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
      }
       ${
         categoryId
           ? `AND vt."id" = '${categoryId}' AND vt."propertyId" = '${propertyId}'`
           : ``
       }
       ${
          categoryName
            ? `AND vt."category_en" = '${categoryName}' `
            : ``
        }
        AND vvs."createdAt" >= '${startDate.toISOString()}'
        AND vvs."createdAt" <= '${endDate.toISOString()}'
      GROUP BY date_time_range
      ORDER BY date_time_range ASC;
`;

    //     const query2 = `
    //     SELECT
    //     TO_CHAR(
    //     DATE_TRUNC('hour', vvs."createdAt"::timestamp)
    //     - (DATE_PART('hour', vvs."createdAt"::timestamp)::integer % 3) * interval '1 hour', 'HH24:MI')
    //     || '-'
    //     || TO_CHAR(
    //       DATE_TRUNC('hour', vvs."createdAt"::timestamp)
    //       - (DATE_PART('hour', vvs."createdAt"::timestamp)::integer % 3) * interval '1 hour'
    //       + interval '3 hours', 'HH24:MI') AS date_time_range,
    //     COUNT(DISTINCT v.id) AS count
    //     from visitors v
    //     JOIN visitor_visitings vv ON vv."visitorId" = v.id
    //     JOIN visitor_visiting_statuses vvs on vvs."visitingId" = vv.id
    //     JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
    //     WHERE vvs.status = '${VISITOR_STATUSES.CHECKIN}' AND ${
    //       buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
    //     }
    //       AND vvs."createdAt" >= '${startDate.toISOString()}'
    //       AND vvs."createdAt" <= '${endDate.toISOString()}'
    //     GROUP BY date_time_range
    //     ORDER BY date_time_range ASC;
    // `;
    await Promise.all(
      (totalVisitor = await db.sequelize.query(query1, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      }))
      // (uniqueVisitors = await db.sequelize.query(query2, {
      //   raw: true,
      //   type: db.Sequelize.QueryTypes.SELECT,
      // }))
    );
    totalVisitor.map((visitor) => {
      bifurcationData[visitor.date_time_range].total = visitor.count;
    });

    // uniqueVisitors.map((visitor) => {
    //   bifurcationData[visitor.date_time_range].unique = visitor.count;
    // });
    return bifurcationData;
  } else if (timeDifference <= oneWeek) {
    const query1 = `
      SELECT
        CASE
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 0 THEN 'Sun'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 1 THEN 'Mon'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 2 THEN 'Tue'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 3 THEN 'Wed'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 4 THEN 'Thu'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 5 THEN 'Fri'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 6 THEN 'Sat'
      END AS day_of_week,
      COUNT(*) AS count
      FROM (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'  
      order by "visitingId", "createdAt" DESC
    ) as vvs
      JOIN visitor_visitings vv ON vv."id" = vvs."visitingId" 
      JOIN visitor_types vt ON vt.id = vv."visitorTypeId"
      JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
      WHERE  ${
        buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
      }
    ${
      categoryId
        ? `AND vt."id" = '${categoryId}' AND vt."propertyId" = '${propertyId}'`
        : ``
    }
        ${
          categoryName
            ? `AND vt."category_en" = '${categoryName}' `
            : ``
        }
        AND vvs."createdAt" >= '${startDate.toISOString()}'
        AND vvs."createdAt" <= '${endDate.toISOString()}'
      GROUP BY day_of_week
      ORDER BY day_of_week ASC;

`;
    //     const query2 = `
    //       SELECT
    //         CASE
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 0 THEN 'Sun'
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 1 THEN 'Mon'
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 2 THEN 'Tue'
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 3 THEN 'Wed'
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 4 THEN 'Thu'
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 5 THEN 'Fri'
    //           WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 6 THEN 'Sat'
    //         END AS day_of_week,
    //         COUNT(DISTINCT v.id) AS count
    //       FROM visitors v
    //       JOIN visitor_visitings vv ON vv."visitorId" = v.id
    //       JOIN visitor_visiting_statuses vvs ON vvs."visitingId" = vv.id
    //       JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
    //       WHERE vvs.status = '${VISITOR_STATUSES.CHECKIN}' AND ${
    //       buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
    //     }
    //             AND vvs."createdAt" >= '${startDate.toISOString()}'
    //             AND vvs."createdAt" <= '${endDate.toISOString()}'
    //       GROUP BY day_of_week
    //       ORDER BY day_of_week ASC;
    // `;
    await Promise.all(
      (totalVisitor = await db.sequelize.query(query1, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      }))
      // (uniqueVisitors = await db.sequelize.query(query2, {
      //   raw: true,
      //   type: db.Sequelize.QueryTypes.SELECT,
      // }))
    );
    totalVisitor.map((visitor) => {
      bifurcationData[visitor.day_of_week].total = visitor.count;
    });

    // uniqueVisitors.map((visitor) => {
    //   bifurcationData[visitor.day_of_week].unique = visitor.count;
    // });

    return bifurcationData;
  } else if (timeDifference <= thirtyDays) {
    const weekData = {};
    const query1 = `
      SELECT
      TO_CHAR(
      DATE_TRUNC('week', vvs."createdAt"::timestamp AT TIME ZONE 'UTC'), 'MM/DD')
      || '-'
      || TO_CHAR(
        DATE_TRUNC('week', vvs."createdAt"::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 days - 1 second', 'MM/DD') AS week_date_range,
      COUNT(*) AS count
      FROM (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'  
      order by "visitingId", "createdAt" DESC
    ) as vvs
      JOIN visitor_visitings vv ON vv."id" = vvs."visitingId" 
      JOIN visitor_types vt ON vt.id = vv."visitorTypeId"
      JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
      WHERE ${
        buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
      }
       ${
         categoryId
           ? `AND vt."id" = '${categoryId}' AND vt."propertyId" = '${propertyId}'`
           : ``
       }
        ${
          categoryName
            ? `AND vt."category_en" = '${categoryName}' `
            : ``
        }
        AND vvs."createdAt" >= '${startDate.toISOString()}'
        AND vvs."createdAt" <= '${endDate.toISOString()}'
      GROUP BY week_date_range
      ORDER BY week_date_range ASC;
`;

    //     const query2 = `
    //     SELECT
    //     TO_CHAR(
    //     DATE_TRUNC('week', vvs."createdAt"::timestamp AT TIME ZONE 'UTC'), 'MM/DD')
    //     || '-'
    //     || TO_CHAR(
    //       DATE_TRUNC('week', vvs."createdAt"::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 days - 1 second', 'MM/DD') AS week_date_range,
    //     COUNT(DISTINCT v.id) AS count
    //     FROM visitors v
    //     JOIN visitor_visitings vv ON vv."visitorId" = v.id
    //     JOIN visitor_visiting_statuses vvs ON vvs."visitingId" = vv.id
    //     JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
    //       WHERE vvs.status = '${VISITOR_STATUSES.CHECKIN}' AND ${
    //       buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
    //     }
    //       AND vvs."createdAt" >= '${startDate.toISOString()}'
    //       AND vvs."createdAt" <= '${endDate.toISOString()}'
    //     GROUP BY week_date_range
    //     ORDER BY week_date_range ASC;
    // `;
    await Promise.all(
      (totalVisitor = await db.sequelize.query(query1, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      }))
      // (uniqueVisitors = await db.sequelize.query(query2, {
      //   raw: true,
      //   type: db.Sequelize.QueryTypes.SELECT,
      // }))
    );
    totalVisitor.map((date) => {
      if (!weekData[date.week_date_range]) {
        weekData[date.week_date_range] = {
          total: 0,
        };
      }

      weekData[date.week_date_range].total = parseInt(date.count);
    });
    // uniqueVisitors.map((date) => {
    //   if (!weekData[date.week_date_range]) {
    //     weekData[date.week_date_range] = {
    //       total: 0,
    //       unique: 0,
    //     };
    //   }

    //   weekData[date.week_date_range].unique = parseInt(date.count);
    // });
    const keyArray = Object.keys(weekData).map((key) => ({
      key,
      value: weekData[key],
    }));

    keyArray.sort((a, b) => {
      const dateA = new Date(a.key.split("-")[0]);
      const dateB = new Date(b.key.split("-")[0]);
      return dateA - dateB;
    });
    const sortedWeekData = {};
    keyArray.forEach((item) => {
      sortedWeekData[item.key] = item.value;
    });

    return Object.keys(weekData).length !== 0
      ? sortedWeekData
      : bifurcationData;
  } else {
    const query1 = `
    SELECT
    TO_CHAR(vvs."createdAt"::timestamp, 'FMMonth') AS month,
    COUNT(*) AS count
    FROM (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'  
      order by "visitingId", "createdAt" DESC
    ) as vvs
      JOIN visitor_visitings vv ON vv."id" = vvs."visitingId" 
      JOIN visitor_types vt ON vt.id = vv."visitorTypeId"
      JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
      WHERE  ${
        buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
      }
       ${
         categoryId
           ? `AND vt."id" = '${categoryId}' AND vt."propertyId" = '${propertyId}'`
           : ``
       }
        ${
          categoryName
            ? `AND vt."category_en" = '${categoryName}' `
            : ``
        }
        AND vvs."createdAt" >= '${startDate.toISOString()}'
        AND vvs."createdAt" <= '${endDate.toISOString()}'
    GROUP BY month
    ORDER BY month ASC;

  `;
    //     const query2 = `
    //     SELECT
    //       TO_CHAR(vvs."createdAt"::timestamp, 'FMMonth') AS month,
    //       COUNT(DISTINCT v.id) AS count
    //     FROM visitors v
    //     JOIN visitor_visitings vv ON vv."visitorId" = v.id
    //     JOIN visitor_visiting_statuses vvs ON vvs."visitingId" = vv.id
    //     JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
    //       WHERE vvs.status = '${VISITOR_STATUSES.CHECKIN}' AND ${
    //       buildingIds.length ? `f."buildingId" IN (${buildingIdsString})` : `0=1`
    //     }
    //       AND vvs."createdAt" >= '${startDate.toISOString()}'
    //       AND vvs."createdAt" <= '${endDate.toISOString()}'
    //     GROUP BY month
    //     ORDER BY month ASC;
    // `;
    await Promise.all(
      (totalVisitor = await db.sequelize.query(query1, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
      }))
      // (uniqueVisitors = await db.sequelize.query(query2, {
      //   raw: true,
      //   type: db.Sequelize.QueryTypes.SELECT,
      // }))
    );

    totalVisitor.map((visitor) => {
      bifurcationData[visitor.month].total = visitor.count;
    });

    // uniqueVisitors.map((visitor) => {
    //   bifurcationData[visitor.month].unique = visitor.count;
    // });

    return bifurcationData;
  }
};

const getVisitorDashboardAnalytics = async ({
  startDate,
  endDate,
  buildingIds,
  bifurcationData,
  type,
  categoryId,
  categoryName,
  propertyId,
}) => {
  let query, totalVisitors;
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  const buildingIdsString = buildingIds.map((id) => `'${id}'`).join(", ");
  switch (type) {
    case VISITOR_STATS_BIFURCATION_TYPES.HOUR:
      query = `SELECT
      TO_CHAR(
      DATE_TRUNC('hour', vvs."createdAt"::timestamp)
      - (DATE_PART('hour', vvs."createdAt"::timestamp)::integer % 1) * interval '1 hour', 'HH24:MI')
      || '-'
      || TO_CHAR(
        DATE_TRUNC('hour', vvs."createdAt"::timestamp)
        - (DATE_PART('hour', vvs."createdAt"::timestamp)::integer % 1) * interval '1 hour' 
        + interval '1 hours', 'HH24:MI') AS time_range,
      COUNT(*)::INTEGER AS count
          FROM (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'  
      order by "visitingId", "createdAt" DESC
    ) as vvs
      JOIN visitor_visitings vv ON vv."id" = vvs."visitingId" 
      JOIN visitor_types vt ON vv."visitorTypeId" =  vt.id
      JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
      WHERE 
        vvs."createdAt" >= '${startDate.toISOString()}'
        AND vvs."createdAt" <= '${endDate.toISOString()}'
        AND ${
          buildingIds.length
            ? `f."buildingId" IN (${buildingIdsString})`
            : `0=1`
        }
        ${
          categoryId
            ? `AND vt."id" = '${categoryId}'`
            : ``
        }
        ${
          categoryName
            ? `AND vt."category_en" = '${categoryName}' `
            : ``
        }
      GROUP BY time_range
      ORDER BY time_range ASC;`;
      break;
    case VISITOR_STATS_BIFURCATION_TYPES.WEEK:
      query = ` SELECT
        CASE
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 0 THEN 'Sun'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 1 THEN 'Mon'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 2 THEN 'Tue'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 3 THEN 'Wed'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 4 THEN 'Thu'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 5 THEN 'Fri'
          WHEN EXTRACT(DOW FROM vvs."createdAt"::timestamp) = 6 THEN 'Sat'
        END AS time_range,
        COUNT(*)::INTEGER AS count
      FROM (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs
      JOIN visitor_visitings vv ON vv."id" = vvs."visitingId" 
      JOIN visitor_types vt ON vv."visitorTypeId" =  vt.id
      JOIN visitors v ON v.id = vv."visitorId"
      JOIN flats f ON (f.id = vv."flatId" AND f."deletedAt" IS NULL)
      WHERE 
        vvs."createdAt" >= '${startDate.toISOString()}'
        AND vvs."createdAt" <= '${endDate.toISOString()}'
        AND ${
          buildingIds.length
            ? `f."buildingId" IN (${buildingIdsString})`
            : `0=1`
        }
          ${
            categoryId
              ? `AND vt."id" = '${categoryId}'`
              : ``
          }
          ${
          categoryName
            ? `AND vt."category_en" = '${categoryName}' `
            : ``
        }
      GROUP BY time_range
      ORDER BY time_range ASC;`;
      break;
    default:
      break;
  }

  totalVisitors = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
  });

  totalVisitors.map((visitor) => {
    bifurcationData[visitor.time_range] =
      bifurcationData[visitor.time_range] + visitor.count;
  });
  return bifurcationData;
};

const doGetAverageDailyVisitors = async ({
  startDate,
  endDate,
  buildingIds,
}) => {
  const query = `SELECT AVG(count) as "averageVisitors"
FROM (
  SELECT COUNT(vvs.*) as count, DATE(vvs."createdAt") as date
  FROM visitor_visiting_statuses vvs 
  JOIN visitor_visitings vv ON vv.id = vvs."visitingId"
  JOIN flats f ON (f.id = vv."flatId" AND f."buildingId" IN (:buildingIds))
  WHERE vvs.status = :status  and vvs."createdAt" >= :startDate  AND vvs."createdAt" <= :endDate
  GROUP BY date
) as daily_counts;`;

  const avgVisitorsDaily = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      status: VISITOR_STATUSES.CHECKIN,
      buildingIds,
      startDate,
      endDate,
    },
  });
  return avgVisitorsDaily[0]?.averageVisitors
    ? avgVisitorsDaily[0]?.averageVisitors
    : 0;
};

const doGetAverageVisitorsPerFlatPerMonth = async ({
  endDate,
  startDate,
  buildingIds,
}) => {
  const query = `
SELECT AVG(count) as "averageVisitors"
FROM (
  SELECT COUNT(vvs.*) as count, DATE_TRUNC('month', vvs."createdAt") as month, f.id as flat_id
  FROM visitor_visiting_statuses vvs 
  JOIN visitor_visitings vv ON vv.id = vvs."visitingId"
  JOIN flats f ON (f.id = vv."flatId" AND f."buildingId" IN (:buildingIds))
  WHERE vvs.status = :status  AND vvs."createdAt" >= :startDate AND vvs."createdAt" <= :endDate
  GROUP BY month, flat_id
) as daily_counts;
`;

  const avgVisitorsMonthly = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      status: VISITOR_STATUSES.CHECKIN,
      buildingIds,
      startDate,
      endDate,
    },
  });
  return avgVisitorsMonthly[0]?.averageVisitors
    ? avgVisitorsMonthly[0]?.averageVisitors
    : 0;
};

module.exports = {
  validateGuardIdForVisiting,
  updateVisitingStatus,
  getCurrentStatus,
  approvedOrDenyVisitor,
  getMoveinAndMoveoutCount,
  getVisitorVisitingsStatus,
  autoCheckOutCron,
  getVisitingsCount,
  getVisitingsCountFromLastStatus,
  getDeliveriesCount,
  getDeliveriesCountByCompany,
  getAverageVisitDurationByCategory,
  getAverageVisitDuration,
  visitingOverviewGraph,
  getVisitingsCountAnalytics,
  doGetAverageDailyVisitors,
  doGetAverageVisitorsPerFlatPerMonth,
  getVisitorDashboardAnalytics,
};
