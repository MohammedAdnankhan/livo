const { Op } = require("sequelize");
const moment = require("moment-timezone");
const {
  getBuildingCount,
  getBuildings,
} = require("../../building-service/controllers/building");
const {
  getTotalAmount,
  getTotalCollectedAmount,
} = require("../../charge-service/controllers/charge");
const {
  TIMEZONES,
  VISITOR_STATUSES,
  MONTHS,
  BIFURCATION_TYPE,
  VISITING_STATUSES,
  VISITOR_STATS_BIFURCATION_TYPES,
} = require("../../config/constants");
const {
  getFlatCount,
  totalFlatCount,
} = require("../../flat-service/controllers/flat");
const {
  getOccupiedFlatCount,
  getResidingOwnerCount,
  getResidingOwnersCountDateWise,
  getResidentCount,
} = require("../../flatContract-service/controllers/flatContract");
const {
  getOccupiedFlatCountForUnitStat,
} = require("../../lease-service/controllers/lease.analytics");
const {
  getUserTypeCount,
} = require("../../lease-service/controllers/lease.analytics");
const {
  getMaintenanceRequestsCount,
  getTotalRequestCount,
} = require("../../maintenanceRequest-service/controllers/maintenanceRequest");
const {
  getUserCount,
  getOwnersCount,
} = require("../../masterUser-service/controllers/masterUser");
const {
  getUsersCount,
  getLoginRequestCount,
} = require("../../user-service/controllers/user");
const { AppError } = require("../../utils/errorHandler");
const { getDateTimeObjectFromTimezone } = require("../../utils/utility");
const {
  getMoveinAndMoveoutCount,
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
} = require("../../visiting-service/controllers/visitingStatus");
const {
  getVisitorTrafficByCategory,
} = require("../../visitor-service/controllers/visitorType");
const {
  getDailyVisitorTraffic,
} = require("../../visiting-service/controllers/visiting");
const {
  getUniqueVisitors,
  getUniqueVisitorsNew,
  getRepeatedVisitors,
  getVisitorsCount,
} = require("../../visitor-service/controllers/visitor");
const {
  getMaintenanceBifurcationStatistics,
  getMaintenanceBifurcationStatWithBuilding,
  maintenanceRequestGraph,
  getMaintenanceAreaAnalytics,
} = require("../../maintenanceRequest-service/controllers/adminMaintenanceRequest");
const {
  flatUsageStatus,
  getLeaseStatusAnalytics,
  getLeaseTypeAnalytics,
} = require("../../lease-service/controllers/lease");
const {
  getActiveLoggedInGuards,
} = require("../../guard-service/controllers/guard");

//get dashboard
const getDashboard = async (
  // { buildingId },
  params,
  { startDate, endDate },
  timezone = TIMEZONES.INDIA
) => {
  if (!startDate || !endDate) {
    throw new AppError(
      "getDashboard",
      "Enter both start and end date",
      "custom",
      412
    );
  }
  startDate = moment(getDateTimeObjectFromTimezone(startDate, timezone))
    .tz(timezone)
    .startOf("day")
    .format();
  endDate = moment(getDateTimeObjectFromTimezone(endDate, timezone))
    .tz(timezone)
    .endOf("day")
    .format();

  const [
    buildingOverview,
    chargeOverview,
    flatOverview,
    visitingOverview,
    maintenanceRequestsOverview,
  ] = await Promise.all([
    getBuildingOverview(params),
    getChargeOverview(params, { startDate, endDate }),
    getFlatOverview(params),
    getMoveinAndMoveoutCount(params, { startDate, endDate }),
    getMaintenanceRequestsCount(params, { startDate, endDate }),
  ]);

  return {
    buildingOverview,
    chargeOverview,
    flatOverview,
    visitingOverview,
    maintenanceRequestsOverview,
  };
};

//get buildings overview
async function getBuildingOverview(params) {
  let buildingParams = {},
    userParams,
    flatParams;
  if (params.buildingId) {
    buildingParams.id = params.buildingId;
    userParams = { buildingId: params.buildingId };
    flatParams = { id: params.buildingId };
  } else {
    buildingParams.propertyId = params.propertyId;
    let buildingsIdObj = [],
      userBuildingsIdObj = [];
    const buildings = await getBuildings({ propertyId: params.propertyId });
    buildings.map((building) => {
      buildingsIdObj.push({ id: building.id });
      userBuildingsIdObj.push({ buildingId: building.id });
    });
    flatParams = { [Op.or]: buildingsIdObj };
    userParams = { [Op.or]: userBuildingsIdObj };
  }

  const [buildings, flats, users] = await Promise.all([
    getBuildingCount(buildingParams),
    getFlatCount(flatParams),
    getUserCount(userParams),
  ]);

  return { ...buildings, ...flats, ...users };
}

//get charges overview
async function getChargeOverview(params, { startDate, endDate }) {
  let totalAmountParams, collectedAmountParams;
  if (params.buildingId) {
    totalAmountParams = { buildingId: params.buildingId };
    collectedAmountParams = { buildingId: params.buildingId };
  } else {
    let buildingsIds = [];
    const buildings = await getBuildings({ propertyId: params.propertyId });
    buildings.map((building) => {
      buildingsIds.push(building.id);
    });
    totalAmountParams = { buildingId: { [Op.in]: buildingsIds } };
    collectedAmountParams = buildingsIds;
  }
  const [totalAmount, totalCollected] = await Promise.all([
    getTotalAmount(totalAmountParams, { startDate, endDate }),
    getTotalCollectedAmount(collectedAmountParams, { startDate, endDate }),
  ]);

  const pending = totalAmount.totalAmount - totalCollected[0].totalCollected;

  return {
    ...totalCollected[0],
    ...totalAmount,
    pending: Math.round((pending + Number.EPSILON) * 100) / 100,
  };
}

async function getFlatOverview(params) {
  let ownerAndOccupiedFlatParams, flatParams;
  if (params.buildingId) {
    ownerAndOccupiedFlatParams = { buildingId: params.buildingId };
    flatParams = { id: params.buildingId };
  } else {
    let buildingsIds = [];
    const buildings = await getBuildings({ propertyId: params.propertyId });
    buildings.map((building) => {
      buildingsIds.push(building.id);
    });
    ownerAndOccupiedFlatParams = { buildingId: { [Op.in]: buildingsIds } };
    flatParams = { "$building.id$": { [Op.in]: buildingsIds } };
  }

  const [residingOwners, totalFlats, flatsOccupied] = await Promise.all([
    getResidingOwnerCount(ownerAndOccupiedFlatParams),
    getFlatCount(flatParams),
    getOccupiedFlatCount(ownerAndOccupiedFlatParams),
  ]);

  const tenants = flatsOccupied.flatsOccupied - residingOwners.residingOwners;
  return { ...totalFlats, ...flatsOccupied, ...residingOwners, tenants };
}

const getVisitorStatistics = async (
  { startDate, endDate, buildingIds },
  timezone = TIMEZONES.INDIA
) => {
  if (!startDate || !endDate) {
    throw new AppError(
      "getVisitorStatistics",
      "Start date and end date are required",
      "custom",
      412
    );
  }
  startDate = moment(getDateTimeObjectFromTimezone(startDate, timezone))
    .tz(timezone)
    .startOf("day")
    .format();
  endDate = moment(getDateTimeObjectFromTimezone(endDate, timezone))
    .tz(timezone)
    .endOf("day")
    .format();

  /* 
    >>trafficByCategory - data based on categories for a given date range populated as pie-chart
    >>dailyTraffic - data based on daily visitors for a given date range populated as bar graph
    >>totalVisitorTraffic - total visitings for a given date range
    >>totalUniqueVisitors - total unique visitors for a given date range
    >>todayCheckins - total checkins done in the current day
    >>activeVisitors - total visitors who haven't checked out in the current day
    >>checkedOutVisitors - total visitors checked out in the current day
    >>totalDeliveries in the current day
    >>topDeliveryCompanies for a given date range
    >>averageVisitDuration for a given date range
    >>averageVisitDurationByCategory for a given date range
  */

  const [
    trafficByCategory,
    dailyTraffic,
    totalVisitorTraffic,
    totalUniqueVisitors,
    todayCheckins,
    activeVisitors,
    checkedOutVisitors,
    totalDeliveries,
    topDeliveryCompanies,
    averageVisitDuration,
    averageVisitDurationByCategory,
  ] = await Promise.all([
    getVisitorTrafficByCategory({ buildingIds, startDate, endDate }), //trafficByCategory
    getDailyVisitorTraffic({ buildingIds, startDate, endDate }), //dailyTraffic
    getVisitingsCount({ buildingIds, startDate, endDate }), //totalVisitorTraffic
    getUniqueVisitors({ buildingIds, startDate, endDate }), //totalUniqueVisitors
    getVisitingsCount({
      buildingIds,
      startDate: moment.tz(timezone).startOf("day").format(),
      endDate: moment.tz(timezone).endOf("day").format(),
    }), //todayCheckins
    getVisitingsCountFromLastStatus({
      buildingIds,
      status: VISITOR_STATUSES.CHECKIN,
      startDate: moment.tz(timezone).startOf("day").format(),
      endDate: moment.tz(timezone).endOf("day").format(),
    }), //activeVisitors
    getVisitingsCountFromLastStatus({
      buildingIds,
      status: VISITOR_STATUSES.CHECKOUT,
      startDate: moment.tz(timezone).startOf("day").format(),
      endDate: moment.tz(timezone).endOf("day").format(),
    }), //checkedOutVisitors
    getDeliveriesCount({
      buildingIds,
      startDate: moment.tz(timezone).startOf("day").format(),
      endDate: moment.tz(timezone).endOf("day").format(),
    }), //totalDeliveries
    getDeliveriesCountByCompany({ buildingIds, startDate, endDate }), //topDeliveryCompanies
    getAverageVisitDuration({ buildingIds, startDate, endDate }), //averageVisitDuration
    getAverageVisitDurationByCategory({ buildingIds, startDate, endDate }), //averageVisitDurationByCategory
  ]);

  return {
    totalVisitorTraffic,
    totalUniqueVisitors,
    todayCheckins,
    activeVisitors,
    checkedOutVisitors,
    totalDeliveries,
    averageVisitDuration,
    trafficByCategory,
    dailyTraffic,
    topDeliveryCompanies,
    averageVisitDurationByCategory,
  };
};

const getRequestStatistics = async (
  params,
  { startDate, endDate },
  timezone = TIMEZONES.INDIA
) => {
  if (!startDate || !endDate) {
    throw new AppError(
      "getRequestStatistics",
      "Start date and end date are required",
      "custom",
      412
    );
  }
  startDate = moment(getDateTimeObjectFromTimezone(startDate, timezone))
    .tz(timezone)
    .startOf("day")
    .format();
  endDate = moment(getDateTimeObjectFromTimezone(endDate, timezone))
    .tz(timezone)
    .endOf("day")
    .format();

  return await getMaintenanceRequestsCount(params, {
    startDate,
    endDate,
  });
};

const getOverview = async (params) => {
  // const startDateOfCurrentMonth = moment().startOf("month").format();
  // const endDateOfCurrentMonth = moment().endOf("month").format();
  const startDateOfPreviousMonth = moment()
    .subtract(1, "months")
    .startOf("month")
    .format();

  const endDateOfPreviousMonth = moment()
    .subtract(1, "months")
    .endOf("month")
    .format();
  const buildingParams = {};
  let flatParams = {},
    userParams = {},
    requestParams = {},
    loginRequestParams = {};
  if (params.buildingId) {
    buildingParams.id = params.buildingId;
    userParams = { buildingId: params.buildingId };
    flatParams = { "$building.id$": params.buildingId };
    requestParams = { "$flat.building.id$": params.buildingId };
    loginRequestParams = {
      flatId: null,
      requestedFlat: { [Op.ne]: null },
      "$flatRequested.building.id$": params.buildingId,
    };
  } else {
    buildingParams.propertyId = params.propertyId;
    userParams = { propertyId: params.propertyId };
    flatParams = { "$building.propertyId$": params.propertyId };
    requestParams = { "$flat.building.propertyId$": params.propertyId };
    loginRequestParams = {
      flatId: null,
      requestedFlat: { [Op.ne]: null },
      "$flatRequested.building.propertyId$": params.propertyId,
    };
  }

  const [
    previousMonthBuildings,
    previousMonthFlats,
    previousMonthUsers,
    previousMonthRequests,
    previousMonthLoginRequests,
  ] = await Promise.all([
    getBuildingCount({
      ...buildingParams,
      createdAt: {
        [Op.gt]: startDateOfPreviousMonth,
        [Op.lt]: endDateOfPreviousMonth,
      },
    }),

    getFlatCount({
      ...flatParams,
      createdAt: {
        [Op.gt]: startDateOfPreviousMonth,
        [Op.lt]: endDateOfPreviousMonth,
      },
    }),

    getUsersCount({
      ...userParams,

      startDate: startDateOfPreviousMonth,
      endDate: endDateOfPreviousMonth,
    }),

    getTotalRequestCount({
      ...requestParams,
      createdAt: {
        [Op.gt]: startDateOfPreviousMonth,
        [Op.lt]: endDateOfPreviousMonth,
      },
    }),
    getLoginRequestCount({
      ...loginRequestParams,
      createdAt: {
        [Op.gt]: startDateOfPreviousMonth,
        [Op.lt]: endDateOfPreviousMonth,
      },
    }),
  ]);

  const [
    totalBuildings,
    totalFlats,
    totalUsers,
    totalRequests,
    totalLoginRequests,
  ] = await Promise.all([
    getBuildingCount({
      ...buildingParams,
    }),

    getFlatCount({
      ...flatParams,
    }),

    getUsersCount({
      ...userParams,
    }),

    getTotalRequestCount({
      ...requestParams,
    }),
    getLoginRequestCount({
      ...loginRequestParams,
    }),
  ]);

  const buildings = {
    previousMonth: parseInt(previousMonthBuildings.totalBuildings),
    total: parseInt(totalBuildings.totalBuildings),
  };

  const flats = {
    previousMonth: parseInt(previousMonthFlats.totalFlats),
    total: parseInt(totalFlats.totalFlats),
  };

  const users = {
    previousMonth: previousMonthUsers[0].count,
    total: totalUsers[0].count,
  };

  const requests = {
    previousMonth: parseInt(previousMonthRequests.totalRequests),
    total: parseInt(totalRequests.totalRequests),
  };
  const loginRequests = {
    previousMonth: previousMonthLoginRequests,
    total: totalLoginRequests,
  };
  return { buildings, flats, users, requests, loginRequests };
};

const unitAnalytics = async (
  { startDate, endDate },
  propertyId,
  buildingId
) => {
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  const oneYear = 365 * oneDay;
  const bifurcationData = await getTimeWiseBifurcations({
    startDate,
    endDate,
    type: BIFURCATION_TYPE.UNIT_STATS,
  });
  const totalFlatCounts = await totalFlatCount(
    startDate,
    endDate,
    propertyId,
    buildingId
  );
  const occupiedFlatCounts = await getOccupiedFlatCountForUnitStat(
    startDate,
    endDate,
    propertyId,
    buildingId
  );
  let result;
  if (timeDifference <= oneDay) {
    if (totalFlatCounts && totalFlatCounts.length !== 0) {
      totalFlatCounts.map((totalCount) => {
        bifurcationData[totalCount.date_time_range].total = parseInt(
          totalCount.count
        );
      });
    }
    if (occupiedFlatCounts && occupiedFlatCounts.length !== 0) {
      occupiedFlatCounts.map((occupiedCount) => {
        bifurcationData[occupiedCount.date_time_range].occupied = parseInt(
          occupiedCount.count
        );
      });
    }

    result = bifurcationData;
  } else if (timeDifference <= oneWeek) {
    if (totalFlatCounts && totalFlatCounts.length !== 0) {
      totalFlatCounts.map((totalCount) => {
        bifurcationData[totalCount.day_of_week].total = parseInt(
          totalCount.count
        );
      });
    }
    if (occupiedFlatCounts && occupiedFlatCounts.length !== 0) {
      occupiedFlatCounts.map((occupiedCount) => {
        bifurcationData[occupiedCount.day_of_week].occupied = parseInt(
          occupiedCount.count
        );
      });
    }

    result = bifurcationData;
  } else if (timeDifference <= thirtyDays) {
    const weekData = {};
    if (totalFlatCounts && totalFlatCounts.length !== 0) {
      totalFlatCounts.map((totalCount) => {
        weekData[totalCount.week_date_range] = {
          total: parseInt(totalCount.count),
          occupied: 0,
        };
      });
    }
    if (occupiedFlatCounts && occupiedFlatCounts.length !== 0) {
      occupiedFlatCounts.map((occupiedCount) => {
        weekData[occupiedCount.week_date_range] = {
          total: weekData[occupiedCount.week_date_range]?.total
            ? weekData[occupiedCount.week_date_range].total
            : 0,
          occupied: parseInt(occupiedCount.count),
        };
      });
    }

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

    result =
      Object.keys(weekData).length !== 0 ? sortedWeekData : bifurcationData;
  } else {
    const monthData = {};
    if (totalFlatCounts && totalFlatCounts.length !== 0) {
      totalFlatCounts.map((totalCount) => {
        const month = MONTHS[totalCount.month];
        monthData[month] = {
          total: parseInt(totalCount.count),
          occupied: 0,
        };
      });
    }

    if (occupiedFlatCounts && occupiedFlatCounts.length !== 0) {
      occupiedFlatCounts.map((occupiedCount) => {
        const month = MONTHS[occupiedCount.month];
        monthData[month] = {
          total: monthData[month]?.total ? parseInt(monthData[month].total) : 0,
          occupied: parseInt(occupiedCount.flatsOccupied),
        };
      });
    }
    result = Object.keys(monthData).length !== 0 ? monthData : bifurcationData;
  }
  return result;
};

const maintenanceBifurcationStatistics = async (
  { startDate, endDate },
  propertyId
) => {
  // const requestParams = { "$flat.building.propertyId$": propertyId };

  // const totalRequests = await getTotalRequestCount({
  //   ...requestParams,
  //   createdAt: {
  //     [Op.gt]: startDate,
  //     [Op.lt]: endDate,
  //   },
  // });
  const maintenanceBifurcation = await getMaintenanceBifurcationStatistics(
    startDate,
    endDate,
    propertyId
  );
  return maintenanceBifurcation;
  // return { totalRequests, maintenanceBifurcation };
};

const maintenanceBifurcationStatisticsWithBuildingId = async (
  { startDate, endDate },
  propertyId,
  buildingId
) => {
  // const requestParams = {
  //   "$flat.building.id$": buildingId,
  // };

  // // const totalRequests = await getTotalRequestCount({
  // //   ...requestParams,
  // //   createdAt: {
  // //     [Op.gt]: startDate,
  // //     [Op.lt]: endDate,
  // //   },
  // // });

  const maintenanceBifurcation =
    await getMaintenanceBifurcationStatWithBuilding(
      startDate,
      endDate,
      propertyId,
      buildingId
    );
  const categoriesCount = new Map();
  maintenanceBifurcation.forEach(({ name, count }) => {
    categoriesCount.set(name, +count);
  });

  return Object.fromEntries(categoriesCount);
};

const getRoleWiseUserCount = async (params) => {
  const [userTypes] = await Promise.all([
    getUserTypeCount({
      startDate: params.startDate,
      endDate: params.endDate,
      propertyId: params.propertyId,
      buildingId: params.buildingId,
    }),
  ]);
  return {
    "Residing Owners": userTypes["Residing Owners"]
      ? parseInt(userTypes["Residing Owners"])
      : 0,
    Owners: userTypes["Owners"] ? parseInt(userTypes["Owners"]) : 0,
    Residents: userTypes["Residents"] ? parseInt(userTypes["Residents"]) : 0,
    "New Users": parseInt(userTypes["New Users"])
      ? parseInt(userTypes["New Users"])
      : 0,
  };
};

const getMaintenanceStatusAnalytics = async (
  { startDate, endDate },
  propertyId,
  buildingId
) => {
  const bifurcationData = await getTimeWiseBifurcations({
    startDate,
    endDate,
    type: BIFURCATION_TYPE.MAINTENANCE,
  });
  const getAnalytics = await maintenanceRequestGraph(
    startDate,
    endDate,
    bifurcationData,
    propertyId,
    buildingId
  );
  return getAnalytics;
};

const getTimeWiseBifurcations = async ({ startDate, endDate, type }) => {
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  const data = new Map();
  if (timeDifference <= oneDay) {
    const timeWiseKeys = {};
    let startTime = moment(startDate).startOf("day");
    while (startTime < endDate) {
      const endTime = moment(startTime).add(3, "hours");
      const key = `${startTime.format("HH:mm")}-${endTime.format("HH:mm")}`;
      if (type === BIFURCATION_TYPE.MAINTENANCE) {
        timeWiseKeys[key] = {
          open: 0,
          inProcess: 0,
        };
      }
      if (type === BIFURCATION_TYPE.VISITOR) {
        timeWiseKeys[key] = {
          total: 0,
        };
      }
      if (type === BIFURCATION_TYPE.UNIT_STATS) {
        timeWiseKeys[key] = {
          total: 0,
          occupied: 0,
        };
      }

      startTime = endTime;
    }
    data.set("time", timeWiseKeys);
    return data.get("time");
  } else if (timeDifference <= oneWeek) {
    const dayWiseKeys = {};
    let startTime = moment(startDate).startOf("day");
    while (startTime < endDate) {
      const endTime = moment(startTime).add(1, "day");
      const key = startTime.format("ddd");
      if (type === BIFURCATION_TYPE.MAINTENANCE) {
        dayWiseKeys[key] = {
          open: 0,
          inProcess: 0,
        };
      }
      if (type === BIFURCATION_TYPE.VISITOR) {
        dayWiseKeys[key] = {
          total: 0,
        };
      }
      if (type === BIFURCATION_TYPE.UNIT_STATS) {
        dayWiseKeys[key] = {
          total: 0,
          occupied: 0,
        };
      }
      startTime = endTime;
    }
    data.set("day", dayWiseKeys);
    return data.get("day");
  } else if (timeDifference <= thirtyDays) {
    const weekWiseKeys = {};
    let startTime = moment(startDate).startOf("week");
    while (startTime < endDate) {
      const endTime = moment(startTime).add(1, "week");
      if (endTime <= endDate) {
        const key = `${startTime.format("DD/MM")}-${endTime.format("DD/MM")}`;
        if (type === BIFURCATION_TYPE.MAINTENANCE) {
          weekWiseKeys[key] = {
            open: 0,
            inProcess: 0,
          };
        }
        if (type === BIFURCATION_TYPE.VISITOR) {
          weekWiseKeys[key] = {
            total: 0,
          };
        }
        if (type === BIFURCATION_TYPE.UNIT_STATS) {
          weekWiseKeys[key] = {
            total: 0,
            occupied: 0,
          };
        }
      }
      startTime = endTime;
    }
    data.set("week", weekWiseKeys);
    return data.get("week");
  } else {
    const monthWiseKeys = {};

    let startTime = moment(startDate).startOf("month");
    while (startTime <= endDate) {
      const key = startTime.format("MMMM");
      if (type === BIFURCATION_TYPE.MAINTENANCE) {
        monthWiseKeys[key] = {
          open: 0,
          inProcess: 0,
        };
      }
      if (type === BIFURCATION_TYPE.VISITOR) {
        monthWiseKeys[key] = {
          total: 0,
        };
      }

      if (type === BIFURCATION_TYPE.UNIT_STATS) {
        monthWiseKeys[key] = {
          total: 0,
          occupied: 0,
        };
      }
      startTime.add(1, "month");
    }

    return monthWiseKeys;
  }
};

const getTypeWiseTimeBifurcation = async ({ type }) => {
  let bifurcationData;
  switch (type) {
    case VISITOR_STATS_BIFURCATION_TYPES.HOUR:
      bifurcationData = {
        "00:00-01:00": 0,
        "01:00-02:00": 0,
        "02:00-03:00": 0,
        "03:00-04:00": 0,
        "04:00-05:00": 0,
        "05:00-06:00": 0,
        "06:00-07:00": 0,
        "07:00-08:00": 0,
        "08:00-09:00": 0,
        "09:00-10:00": 0,
        "10:00-11:00": 0,
        "11:00-12:00": 0,
        "12:00-13:00": 0,
        "13:00-14:00": 0,
        "14:00-15:00": 0,
        "15:00-16:00": 0,
        "16:00-17:00": 0,
        "17:00-18:00": 0,
        "18:00-19:00": 0,
        "19:00-20:00": 0,
        "20:00-21:00": 0,
        "21:00-22:00": 0,
        "22:00-23:00": 0,
        "23:00-00:00": 0,
      };
      break;
    case VISITOR_STATS_BIFURCATION_TYPES.WEEK:
      bifurcationData = {
        Sun: 0,
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
      };
      break;
  }
  return bifurcationData;
};
const getVisitorAnalytics = async (
  { startDate, endDate, buildingIds },
  timezone = TIMEZONES.INDIA
) => {
  startDate = moment(startDate).startOf("day").format();
  endDate = moment(endDate).tz(timezone).endOf("day").format();

  const [trafficByCategory] = await Promise.all([
    getVisitorTrafficByCategory({ buildingIds, startDate, endDate }), //trafficByCategory
  ]);
  trafficByCategory.sort((a, b) => parseInt(b.count) - parseInt(a.count));

  const categoryObj = {
    "Delivery":0,
    "Guest":0,
    "Home Services":0,
    "Daily Help":0,
    "Cab":0,
    "Holiday Homes":0,
    "Viewing":0,
    "Office visitor":0,
    "Interview":0,
    "Contractors":0,
    "Property Viewing":0,
    "Audit":0,
    "Staff/Employees":0,
    "Others":0,
  };


  trafficByCategory.map((traffic) => {
    categoryObj[traffic.category] = parseInt(traffic.count);
  });

  return categoryObj;
};

const getVisitorStatisticsCards = async ({
  startDate,
  endDate,
  buildingIds,
}) => {
  // const startDateOfMonth = moment().startOf("month").toDate();
  // const currentDate = moment().toDate();
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  // const previousStartDateOfMonth = moment()
  //   .subtract(1, "months")
  //   .startOf("month")
  //   .toDate();
  // const previousEndDateOfMonth = moment()
  //   .subtract(1, "months")
  //   .endOf("month")
  //   .toDate();

  const [
    totalVisitings,
    totalVisitors,
    totalUniqueVisitorsOld,
    totalUniqueVisitors,
    totalRepeatedVisitors,
    // totalCheckinsThisMonth,
    totalDeliveriesThisMonth,
    getTotalAverageVisitDuration,
    totalAverageDailyVisitors,
    totalAverageVisitorsPerFlatPerMonth,
  ] = await Promise.all([
    getVisitingsCountAnalytics({
      buildingIds,
      startDate,
      endDate,
    }), //totalVisitingCount
    getVisitorsCount({
      buildingIds,
      startDate,
      endDate,
    }), //total visitor count
    getUniqueVisitors({
      buildingIds,
      startDate,
      endDate,
    }),
    getUniqueVisitorsNew({
      buildingIds,
      startDate,
      endDate,
    }), //totalUniqueVisitors
    getRepeatedVisitors({
      buildingIds,
      startDate,
      endDate,
    }), //repeated visitors
    // getVisitingsCountAnalytics({
    //   buildingIds,
    //   startDate: null,
    //   endDate,
    // }), //todayCheckins
    getDeliveriesCount({
      buildingIds,
      startDate,
      endDate,
    }), //totalDeliveries
    getAverageVisitDuration({
      buildingIds,
      startDate,
      endDate,
    }),
    doGetAverageDailyVisitors({
      buildingIds,
      startDate,
      endDate,
    }),
    doGetAverageVisitorsPerFlatPerMonth({
      buildingIds,
      startDate,
      endDate,
    }),

    // getVisitingsCountAnalytics({
    //   buildingIds,
    //   startDate: previousStartDateOfMonth,
    //   endDate: previousEndDateOfMonth,
    // }), //totalVisitorTraffic
    // getUniqueVisitors({
    //   buildingIds,
    //   startDate: previousStartDateOfMonth,
    //   endDate: previousEndDateOfMonth,
    // }), //totalUniqueVisitors
    // getVisitingsCountAnalytics({
    //   buildingIds,
    //   startDate: previousStartDateOfMonth,
    //   endDate: previousEndDateOfMonth,
    // }), //todayCheckins
    // getDeliveriesCount({
    //   buildingIds,
    //   startDate: previousStartDateOfMonth,
    //   endDate: previousEndDateOfMonth,
    // }), //totalDeliveries
  ]);

  const visitorObj = {
    totalVisitors: parseInt(totalVisitors),
    totalVisitings: parseInt(totalVisitings),
    totalUniqueVisitorsOld: parseInt(totalUniqueVisitorsOld),
    // {
    //   total: parseInt(totalVisitorTrafficThisMonth),
    //   // previousMonth: parseInt(totalVisitorTrafficPreviousMonth),
    //   // percentageDifference: percentageDifferenceTotalVisitors,
    //   // isIncreasing:
    //   //   percentageDifferenceTotalVisitors > 0 ||
    //   //   percentageDifferenceTotalVisitors == null
    //   //     ? true
    //   //     : false,
    // }
    totalUniqueVisitors: parseInt(totalUniqueVisitors),
    // {
    //   total: parseInt(totalUniqueVisitorsThisMonth),
    //   // previousMonth: parseInt(totalUniqueVisitorsPreviousMonth),
    //   // percentageDifference: percentageDifferenceUniqueVisitors,
    //   // isIncreasing:
    //   //   percentageDifferenceUniqueVisitors > 0 ||
    //   //   percentageDifferenceUniqueVisitors == null
    //   //     ? true
    //   //     : false,
    // }
    // totalCheckins: {
    //   total: parseInt(totalCheckinsThisMonth),
    //   // previousMonth: parseInt(totalCheckinsPreviousMonth),
    //   // percentageDifference: percentageDifferenceCheckins,
    //   // isIncreasing:
    //   //   percentageDifferenceCheckins > 0 || percentageDifferenceCheckins == null
    //   //     ? true
    //   //     : false,
    // },
    totalDeliveries: parseInt(totalDeliveriesThisMonth),
    // {
    //   total: parseInt(totalDeliveriesThisMonth),
    //   // previousMonth: parseInt(totalDeliveriesPreviousMonth),
    //   // percentageDifference: percentageDifferenceDeliveries,
    //   // isIncreasing:
    //   //   percentageDifferenceDeliveries > 0 ||
    //   //   percentageDifferenceDeliveries == null
    //   //     ? true
    //   //     : false,
    // },
    totalRepeatVisitorRate: Math.floor(
      (parseInt(totalRepeatedVisitors) /
        (parseInt(totalRepeatedVisitors) + parseInt(totalUniqueVisitors))) *
        100
    )
      ? Math.floor(
          (parseInt(totalRepeatedVisitors) /
            (parseInt(totalRepeatedVisitors) + parseInt(totalUniqueVisitors))) *
            100
        )
      : 0,
    averageVisitDuration: parseInt(getTotalAverageVisitDuration),
    averageDailyVisitors: parseInt(totalAverageDailyVisitors),
    averageVisitorsPerFlatPerMonth: parseInt(
      totalAverageVisitorsPerFlatPerMonth
    ),
  };
  return visitorObj;
};

const getVisitorStatisticsTopCards = async ({
  buildingIds,
  startDate,
  endDate,
}) => {
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();

  const [totalCheckins, totalActive, totalDeliveries, totalActiveGuards] =
    await Promise.all([
      getVisitingsCountAnalytics({
        buildingIds,
        startDate,
        endDate,
      }), //totalCheckins
      getVisitingsCountFromLastStatus({
        buildingIds,
        status: VISITOR_STATUSES.CHECKIN,
        startDate,
        endDate,
      }), //activeVisitors
      getDeliveriesCount({
        buildingIds,
        startDate,
        endDate,
      }), //totalDeliveries
      getActiveLoggedInGuards({
        buildingIds,
        startDate,
        endDate,
      }), //totalActiveGuards
    ]);

  const visitorObj = {
    totalCheckins: parseInt(totalCheckins),
    totalActive: parseInt(totalActive),
    totalDeliveries: parseInt(totalDeliveries),
    totalActiveGuards: parseInt(totalActiveGuards),
  };
  return visitorObj;
};

const getVisitorStatisticsByCompanies = async ({
  buildingIds,
  startDate,
  endDate,
}) => {
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();

  const totalDeliveries = await getDeliveriesCountByCompany({
    buildingIds,
    startDate,
    endDate,
  });
  return totalDeliveries;
};
const getVisitorAnalyticsGraph = async (
  { startDate, endDate, categoryId,categoryName, propertyId },
  buildingIds
) => {
  const bifurcationData = await getTimeWiseBifurcations({
    startDate,
    endDate,
    type: BIFURCATION_TYPE.VISITOR,
  });

  const getAnalytics = await visitingOverviewGraph(
    startDate,
    endDate,
    bifurcationData,
    categoryId,
    categoryName,
    propertyId,
    buildingIds
  );
  return getAnalytics;
};

const maintenanceAreaStatistics = async (
  { startDate, endDate },
  propertyId,
  buildingId
) => {
  const maintenanceAreaStats = await getMaintenanceAreaAnalytics(
    startDate,
    endDate,
    propertyId,
    buildingId
  );

  return maintenanceAreaStats;
};

const getLeaseAnalyticsChart = async ({
  startDate,
  endDate,
  buildingId,
  propertyId,
}) => {
  const getAnalytics = await flatUsageStatus({
    startDate,
    endDate,
    propertyId,
    buildingId,
  });
  return getAnalytics;
};

const getLeaseAnalytics = async ({
  startDate,
  endDate,
  buildingId,
  propertyId,
}) => {
  const getAnalytics = await getLeaseStatusAnalytics({
    startDate,
    endDate,
    propertyId,
    buildingId,
  });
  return getAnalytics;
};

const leaseTypeAnalytics = async ({
  startDate,
  endDate,
  buildingId,
  propertyId,
}) => {
  const getAnalytics = await getLeaseTypeAnalytics({
    startDate,
    endDate,
    propertyId,
    buildingId,
  });
  return getAnalytics;
};

const getVisitorData = async ({
  startDate,
  endDate,
  type,
  propertyId,
  buildingIds,
  categoryId,
  categoryName
}) => {
  const bifurcationData = await getTypeWiseTimeBifurcation({
    type,
  });

  const getAnalytics = await getVisitorDashboardAnalytics({
    startDate,
    endDate,
    bifurcationData,
    type,
    buildingIds,
    categoryId,
    categoryName,
    propertyId,
  });
  return getAnalytics;
};

module.exports = {
  getDashboard,
  getOverview,
  getVisitorStatistics,
  getRequestStatistics,
  unitAnalytics,
  maintenanceBifurcationStatistics,
  maintenanceBifurcationStatisticsWithBuildingId,
  getRoleWiseUserCount,
  getMaintenanceStatusAnalytics,
  getVisitorAnalytics,
  getVisitorStatisticsCards,
  getVisitorAnalyticsGraph,
  maintenanceAreaStatistics,
  getLeaseAnalyticsChart,
  getLeaseAnalytics,
  leaseTypeAnalytics,
  getVisitorStatisticsTopCards,
  getVisitorStatisticsByCompanies,
  getVisitorData,
};
