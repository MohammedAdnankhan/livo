const { LANGUAGES, LEASE_STATUSES } = require("../../config/constants");
const Locality = require("../../locality-service/models/Locality");
const City = require("../../city-service/models/City");
const { enableSearch } = require("../../utils/utility");
const { BUILDING_LANGUAGE_VARS } = require("../configs/constants");
const Building = require("../models/Building");
const db = require("../../database");
const Property = require("../../property-service/models/Property");
const moment = require("moment-timezone");
const { Op } = require("sequelize");
const Flat = require("../../flat-service/models/Flat");

const getBuildings = async (params = {}, language = LANGUAGES.EN) => {
  enableSearch(params, "name", language);
  const buildings = await Building.scope("languageHelper").findAll({
    where: params,
    attributes: { include: Object.entries(BUILDING_LANGUAGE_VARS[language]) },
  });

  return buildings;
};

async function getBuilding(params = {}, language = LANGUAGES.EN) {
  return Building.scope("languageHelper").findOne({
    where: params,
    attributes: { include: Object.entries(BUILDING_LANGUAGE_VARS[language]) },
  });
}

async function getBuildingWithCityAndLocality(params) {
  return await Building.findOne({
    where: params,
    include: {
      model: Locality,
      as: "locality",
      include: {
        model: City,
        as: "city",
      },
    },
  });
}

async function getBuildingCount(params) {
  return await Building.findOne({
    where: params,
    attributes: [
      [db.sequelize.fn("count", db.sequelize.col("id")), "totalBuildings"],
    ],
    raw: true,
  });
}

async function getBuildingWithProperty(buildingParams, propertyParams = {}) {
  return await Building.findOne({
    where: buildingParams,
    include: {
      model: Property,
      as: "property",
      where: propertyParams,
      required: true,
    },
  });
}

const getBuildingStatistics = async ({ propertyId }) => {
  // const startDateOfMonth = moment().startOf("month").toDate();
  // const currentDate = moment().toDate();
  const previousStartDateOfMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousEndDateOfMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .toDate();

  const [
    buildings,
    previousMonthBuildings,
    flatStats,
    vacantFlats,
    occupiedFlats,
  ] = await Promise.all([
    getBuildingCount({
      propertyId,
      // createdAt: {
      //   [Op.and]: [{ [Op.gte]: startDateOfMonth }, { [Op.lte]: currentDate }],
      // },
    }),
    getBuildingCount({
      propertyId,
      createdAt: {
        [Op.and]: [
          { [Op.gte]: previousStartDateOfMonth },
          { [Op.lte]: previousEndDateOfMonth },
        ],
      },
    }),
    getFlatsStatistics(propertyId),
    getVacantFlatsStatistics(propertyId),
    getOccupiedFlatsStatistics(propertyId),
  ]);

  const thisMonthBuildings = parseInt(buildings.totalBuildings);
  const previousMonthBuilding = parseInt(previousMonthBuildings.totalBuildings);
  // let percentageDifference = null;
  // if (previousMonthBuilding) {
  //   percentageDifference = parseFloat(
  //     (
  //       ((thisMonthBuildings - previousMonthBuilding) / previousMonthBuilding) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!thisMonthBuildings && !previousMonthBuilding) {
  //   percentageDifference = 0;
  // }

  const buildingStats = {
    building: {
      total: thisMonthBuildings,
      previousMonth: previousMonthBuilding,
    },
    flats: flatStats,
    vacantFlats,
    occupiedFlats,
  };
  return buildingStats;
};

const getFlatsStatistics = async (propertyId) => {
  // const startDateOfMonth = moment().startOf("month").toDate();
  // const currentDate = moment().toDate();
  const previousStartDateOfMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousEndDateOfMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .toDate();

  const [flats, flatInPreviousMonth] = await Promise.all([
    Flat.count({
      // where: {
      //   createdAt: {
      //     [Op.and]: [{ [Op.gte]: startDateOfMonth }, { [Op.lte]: currentDate }],
      //   },
      // },
      include: {
        model: Building,
        as: "building",
        where: { propertyId },
        required: true,
      },
    }),

    Flat.count({
      where: {
        createdAt: {
          [Op.and]: [
            { [Op.gte]: previousStartDateOfMonth },
            { [Op.lte]: previousEndDateOfMonth },
          ],
        },
      },
      include: {
        model: Building,
        as: "building",
        where: { propertyId },
        required: true,
      },
    }),
  ]);
  // let percentageDifference = null;
  // if (flatInPreviousMonth) {
  //   percentageDifference = parseFloat(
  //     (((flats - flatInPreviousMonth) / flatInPreviousMonth) * 100).toFixed(2)
  //   );
  // } else if (!flats && !flatInPreviousMonth) {
  //   percentageDifference = 0;
  // }

  return {
    total: flats,
    previousMonth: flatInPreviousMonth,
    //   percentageDifference,
    //   isIncreasing:
    //     percentageDifference > 0 || percentageDifference == null ? true : false,
  };
};

//TODO: REMOVE FLAT CONTRACTS MAPPING
const getVacantFlatsStatistics = async (propertyId) => {
  // const startDateOfMonth = moment().startOf("month").toDate();
  const currentDate = moment().toDate();
  const previousStartDateOfMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousEndDateOfMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .toDate();

  const queryForFlatsVacantTotal = `
  select count(f.*) from flats f
      left join (
      select distinct on(l."flatId") l.id, l."flatId", ls.status from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc, ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    join buildings b on (b.id = f."buildingId" and b."propertyId" = :propertyId  and b."deletedAt" is null)
    where f."deletedAt" is null and (
      l.id is null or 
      l.status in (:inActiveStatuses) 
    )`;

  const queryForFlatsVacantPreviousMonth = ` select count(f.*) from flats f
    left join (
      select distinct on(l."flatId") l.id, l."flatId", ls.status,l."endDate",l.discount from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc, ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    join buildings b on (b.id = f."buildingId" and b."propertyId" = :propertyId  and b."deletedAt" is null)
    where f."deletedAt" is null and (
      l.id is null or 
      l.status in (:inActiveStatuses)
      and l."endDate"  + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) between :previousStartDateOfMonth AND :previousEndDateOfMonth
    )`;

  const [flats, flatsInPreviousMonth] = await Promise.all([
    db.sequelize.query(queryForFlatsVacantTotal, {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        inActiveStatuses: new Array(
          LEASE_STATUSES.CANCELLED,
          LEASE_STATUSES.EXPIRED,
          LEASE_STATUSES.TERMINATED
        ),
      },
    }),
    db.sequelize.query(queryForFlatsVacantPreviousMonth, {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        previousStartDateOfMonth,
        previousEndDateOfMonth,
        inActiveStatuses: new Array(
          LEASE_STATUSES.CANCELLED,
          LEASE_STATUSES.EXPIRED,
          LEASE_STATUSES.TERMINATED
        ),
      },
    }),
  ]);

  const vacantFlats = parseInt(flats[0].count);
  const vacantFlatsInPreviousMonth = parseInt(flatsInPreviousMonth[0].count);
  // let percentageDifference = null;
  // if (vacantFlatsInPreviousMonth) {
  //   percentageDifference = parseFloat(
  //     (
  //       ((vacantFlats - vacantFlatsInPreviousMonth) /
  //         vacantFlatsInPreviousMonth) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!vacantFlats && !vacantFlatsInPreviousMonth) {
  //   percentageDifference = 0;
  // }
  return {
    total: vacantFlats,
    previousMonth: vacantFlatsInPreviousMonth,
    // percentageDifference
    //   isIncreasing:
    // percentageDifference > 0 || percentageDifference == null ? true : false,
  };
};

//TODO: REMOVE FLAT CONTRACTS MAPPING
const getOccupiedFlatsStatistics = async (propertyId) => {
  // const startDateOfMonth = moment().startOf("month").toDate();
  const currentDate = moment().toDate();
  const previousStartDateOfMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousEndDateOfMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .toDate();

  const queryForFlatsOccupiedTotal = `
  select count(f.*) from flats f
    join (
      select distinct on(l."flatId") l.id, l."flatId", ls.status from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc, ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    join buildings b on (b.id = f."buildingId" and b."propertyId" = :propertyId  and b."deletedAt" is null)
    where f."deletedAt" is null 
    and l.status in (:activeStatuses) `;

  const queryForFlatsOccupiedPreviousMonth = ` select count(f.*) from flats f
    join (
      select distinct on(l."flatId") l.id, l."flatId", ls.status,l."startDate",l.discount from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc, ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    join buildings b on (b.id = f."buildingId" and b."propertyId" = :propertyId and b."deletedAt" is null)
    where f."deletedAt" is null 
    and l.status in (:activeStatuses)
    and l."startDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) between :previousStartDateOfMonth AND :previousEndDateOfMonth`;

  const [flats, flatsInPreviousMonth] = await Promise.all([
    db.sequelize.query(queryForFlatsOccupiedTotal, {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        activeStatuses: new Array(LEASE_STATUSES.ACTIVE),
      },
    }),
    db.sequelize.query(queryForFlatsOccupiedPreviousMonth, {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        propertyId,
        previousStartDateOfMonth,
        previousEndDateOfMonth,
        activeStatuses: new Array(LEASE_STATUSES.ACTIVE),
      },
    }),
  ]);

  const occupiedFlats = parseInt(flats[0].count);
  const occupiedFlatsInPreviousMonth = parseInt(flatsInPreviousMonth[0].count);
  // let percentageDifference = null;
  // if (occupiedFlatsInPreviousMonth) {
  //   percentageDifference = parseFloat(
  //     (
  //       ((occupiedFlats - occupiedFlatsInPreviousMonth) /
  //         occupiedFlatsInPreviousMonth) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!occupiedFlats && !occupiedFlatsInPreviousMonth) {
  //   percentageDifference = 0;
  // }
  return {
    total: occupiedFlats,
    previousMonth: occupiedFlatsInPreviousMonth,
    // percentageDifference,
    // isIncreasing:
    //   percentageDifference > 0 || percentageDifference == null ? true : false,
  };
};

const getBuildingsWithPropertyForExport = async (propertyId, buildingId) => {
  const buildings = await Building.findAll({
    where: buildingId ? { id: buildingId } : { propertyId },
    attributes: [
      "name_en",
      "buildingType",

      [
        db.Sequelize.literal(
          '(SELECT COUNT(flats.id) FROM "flats" AS "flats" WHERE "flats"."buildingId" = "Building"."id")'
        ),

        "totalFlats",
      ],

      [
        db.Sequelize.literal(
          `(select count(f.id)  from flats f

    left join (

      select distinct on("flatId") * from flat_contracts

      where "deletedAt" is null

      order by "flatId", "createdAt" desc

    ) fc on fc."flatId" = f.id

    where f."deletedAt" is null

    and f."buildingId" = "Building"."id"

    and (fc.id is null or now() > fc."contractEndDate" + interval '1 month' * fc.grace or fc."isValid" is false ))`
        ),

        "totalVacantFlats",
      ],
    ],

    include: [
      {
        model: Locality,
        as: "locality",
        attributes: ["name_en"],
        include: {
          model: City,
          as: "city",
          attributes: ["name_en"],
        },
      },
    ],
  });

  return buildings;
};

//TODO: REMOVE FLAT CONTRACTS MAPPING
const exportBuildings = async (params) => {
  const query = `
  select b.name_en, b."buildingType",
  l.name_en as "locality.name_en",
  c.name_en as "locality.city.name_en",
  case when fco."flatsCount" is null then 0 else fco."flatsCount"::INTEGER end as "totalFlats", 
  case when vf."flatsCount" is null then 0 else vf."flatsCount"::INTEGER end as "totalVacantFlats",
  b."primaryContact"  as "pocContact",
  b."governmentPropertyId" as "propertyId"                                           
  from buildings b
  join localities l on (l.id = b."localityId" and l."deletedAt" is null)
  join cities c on (c.id = l."cityId" and c."deletedAt" is null)
  left join (
    select count(*) as "flatsCount", "buildingId" from flats where "deletedAt" is null group by "buildingId"
  ) fco on (fco."buildingId" = b.id)
  left join (
    select count(f.id) as "flatsCount", f."buildingId" from flats f
    left join (
      select distinct on("flatId") * from flat_contracts 
      where "deletedAt" is null
      order by "flatId", "createdAt" desc
    ) fc on fc."flatId" = f.id
    where f."deletedAt" is null
    and (fc.id is null or now() > fc."contractEndDate" + interval '1 month' * fc.grace or fc."isValid" is false)
    group by f."buildingId"
  ) vf on (vf."buildingId" = b.id)
  where b."propertyId" = :propertyId ${
    params.buildingType
      ? `and  b."buildingType" = '${params.buildingType}'`
      : ""
  } and b."deletedAt" is null
  ${params.buildingId ? `and b.id = '${params.buildingId}'` : ""}
  ${
    params.search
      ? `and (
    b.name_en ilike '%${params.search}%' OR
    b."buildingType" ilike '%${params.search}%' OR
    l.name_en ilike '%${params.search}%' OR
    c.name_en ilike '%${params.search}%'
  )`
      : ""
  }
  order by b."updatedAt" desc`;

  return await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
    },
  });
};

module.exports = {
  getBuildings,
  getBuilding,
  getBuildingWithCityAndLocality,
  getBuildingCount,
  getBuildingWithProperty,
  getBuildingStatistics,
  getBuildingsWithPropertyForExport,
  exportBuildings,
};
