const router = require("express").Router();
const {
  USER_TYPES,
  ADMIN_ROLES,
  VISITOR_STATS_BIFURCATION_TYPES,
} = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const dashboardController = require("../controllers/dashboard");
const buildingController = require("../../building-service/controllers/building");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getAnalyticsSchema,
  getVisitorStatisticsSchema,
  getVisitorTotalAnalyticsSchema,
  getVisitorAnalyticsSchema,
} = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");
const ownerDashboardRoutes = require("./owner.routes");

router.use("/owner", authToken([USER_TYPES.OWNER]), ownerDashboardRoutes);

router.get(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  // validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const params = {};
      if (req.query.buildingId) {
        params.buildingId = req.query.buildingId;
      } else {
        params.propertyId = req.currentAdmin.propertyId;
      }
      const dashboard = await dashboardController.getDashboard(
        params,
        req.query,
        req.timezone
      );
      res.json({
        status: "success",
        data: dashboard,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /dashboard";
      next(error);
    }
  }
);

//get request statistics
router.get(
  "/request-statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const params = {};
      if (req.query.buildingId) {
        params.buildingId = req.query.buildingId;
      } else {
        params.propertyId = req.currentAdmin.propertyId;
      }
      const stats = await dashboardController.getRequestStatistics(
        params,
        req.query,
        req.timezone
      );
      res.json({
        status: "success",
        data: stats,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /dashboard";
      next(error);
    }
  }
);

router.get(
  "/visitor-statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        const buildings = await buildingController.getBuildings({
          propertyId: req.currentAdmin.propertyId,
        });
        buildingIds = buildings.map((building) => building.id);
      }

      // Return empty visitor statistics if no buildings found
      if (buildingIds.length === 0) {
        return res.json({
          status: "success",
          data: {
            totalVisitors: 0,
            visitorsByType: {},
            visitorsByDate: [],
            visitorsByTime: {},
          },
        });
      }

      const stats = await dashboardController.getVisitorStatistics(
        { ...req.query, buildingIds },
        req.timezone
      );

      res.json({
        status: "success",
        data: stats,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor-traffic";
      next(error);
    }
  }
);

router.get(
  "/overview",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  // validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const params = {};
      if (req.query.buildingId) {
        params.buildingId = req.query.buildingId;
      } else {
        params.propertyId = req.currentAdmin.propertyId;
      }
      const dashboard = await dashboardController.getOverview(
        params,
        req.query
      );
      res.json({
        status: "success",
        data: dashboard,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /overview";
      next(error);
    }
  }
);

router.get(
  "/units",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      dashboard = await dashboardController.unitAnalytics(
        req.query,
        req.currentAdmin.propertyId,
        req.currentAdmin.buildingId
      );

      res.json({
        status: "success",
        data: dashboard,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/units";
      next(error);
    }
  }
);

router.get(
  "/maintenance-bifurcation/statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      if (req.currentAdmin.buildingId) {
        dashboard =
          await dashboardController.maintenanceBifurcationStatisticsWithBuildingId(
            req.query,
            req.currentAdmin.propertyId,
            req.currentAdmin.buildingId
          );
      } else {
        dashboard = await dashboardController.maintenanceBifurcationStatistics(
          req.query,
          req.currentAdmin.propertyId
        );
      }

      res.status(200).json({
        status: "success",
        // totalRequests: dashboard.totalRequests.totalRequests,
        data: dashboard,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/maintenance-bifurcation/statistics";
      next(error);
    }
  }
);
router.get(
  "/user-stats",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      if (req.currentAdmin.buildingId) {
        dashboard = await dashboardController.getRoleWiseUserCount({
          ...req.query,
          propertyId: req.currentAdmin.propertyId,
          buildingId: req.currentAdmin.buildingId,
        });
      } else {
        dashboard = await dashboardController.getRoleWiseUserCount({
          ...req.query,
          propertyId: req.currentAdmin.propertyId,
        });
      }

      sendResponse(res, dashboard);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/user-stats";
      next(error);
    }
  }
);

router.get(
  "/maintenance-stats",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      if (req.currentAdmin.buildingId) {
        dashboard = await dashboardController.getMaintenanceStatusAnalytics(
          {
            ...req.query,
          },
          req.currentAdmin.propertyId,
          req.currentAdmin.buildingId
        );
      } else {
        dashboard = await dashboardController.getMaintenanceStatusAnalytics(
          {
            ...req.query,
          },
          req.currentAdmin.propertyId
        );
      }

      res.json({
        status: "success",
        data: dashboard,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/maintenance-stats";
      next(error);
    }
  }
);

router.get(
  "/visitor/category-analytics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        const buildings = await buildingController.getBuildings({
          propertyId: req.currentAdmin.propertyId,
        });
        buildingIds = buildings.map((building) => building.id);
      }

      // Return empty analytics if no buildings found
      if (buildingIds.length === 0) {
        return res.json({
          status: "success",
          data: {
            categories: [],
            totalVisitors: 0,
          },
        });
      }

      const stats = await dashboardController.getVisitorAnalytics(
        { ...req.query, buildingIds },
        req.timezone
      );

      res.json({
        status: "success",
        data: stats,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor/category-analytics";
      next(error);
    }
  }
);
router.get(
  "/visitor/statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getVisitorStatisticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        const buildings = await buildingController.getBuildings({
          propertyId: req.currentAdmin.propertyId,
        });
        buildingIds = buildings.map((building) => building.id);
      }

      // Return empty stats if no buildings found
      if (buildingIds.length === 0) {
        return res.json({
          status: "success",
          data: {
            totalVisitors: 0,
            visitorsToday: 0,
            pendingApprovals: 0,
            visitorsThisWeek: 0,
            visitorsByType: {},
            visitorsByDate: [],
          },
        });
      }

      const stats = await dashboardController.getVisitorStatisticsCards({
        startDate: req.validatedQuery.startDate,
        endDate: req.validatedQuery.endDate,
        buildingIds,
      });

      res.json({
        status: "success",
        data: stats,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor/statistics";
      next(error);
    }
  }
);

router.get(
  "/visitor/analytics/hourly",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getVisitorAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        (
          await buildingController.getBuildings({
            propertyId: req.currentAdmin.propertyId,
          })
        ).map((building) => {
          buildingIds.push(building.id);
        });
      }
      const stats = await dashboardController.getVisitorData({
        ...req.validatedQuery,
        type: VISITOR_STATS_BIFURCATION_TYPES.HOUR,
        propertyId: req.currentAdmin.propertyId,
        buildingIds,
      });
      sendResponse(res, stats);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor/analytics/hourly";
      next(error);
    }
  }
);

router.get(
  "/visitor/analytics/weekly",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getVisitorAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        (
          await buildingController.getBuildings({
            propertyId: req.currentAdmin.propertyId,
          })
        ).map((building) => {
          buildingIds.push(building.id);
        });
      }
      const stats = await dashboardController.getVisitorData({
        ...req.validatedQuery,
        type: VISITOR_STATS_BIFURCATION_TYPES.WEEK,
        propertyId: req.currentAdmin.propertyId,
        buildingIds,
      });
      sendResponse(res, stats);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor/analytics/weekly";
      next(error);
    }
  }
);
router.get(
  "/visitor/analytics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        const buildings = await buildingController.getBuildings({
          propertyId: req.currentAdmin.propertyId,
        });
        buildingIds = buildings.map((building) => building.id);
      }

      // Return empty stats if no buildings found
      if (buildingIds.length === 0) {
        return sendResponse(res, {
          totalVisitors: 0,
          visitorsThisWeek: 0,
          pendingApprovals: 0,
          visitorsToday: 0,
        });
      }

      const stats = await dashboardController.getVisitorStatisticsTopCards({
        buildingIds,
        startDate: req.validatedQuery.startDate,
        endDate: req.validatedQuery.endDate,
      });

      sendResponse(res, stats);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor/analytics";
      next(error);
    }
  }
);

router.get(
  "/visitor/delivery-analytics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        const buildings = await buildingController.getBuildings({
          propertyId: req.currentAdmin.propertyId,
        });
        buildingIds = buildings.map((building) => building.id);
      }

      // Return empty delivery stats if no buildings found
      if (buildingIds.length === 0) {
        return sendResponse(res, [{ count: 0, company: "Others" }]);
      }

      const stats = await dashboardController.getVisitorStatisticsByCompanies({
        buildingIds,
        startDate: req.validatedQuery.startDate,
        endDate: req.validatedQuery.endDate,
      });

      sendResponse(res, stats);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor/delivery-analytics";
      next(error);
    }
  }
);

router.get(
  "/visitor-stats",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getVisitorAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let buildingIds = [];
      if (req.currentAdmin.buildingId) {
        buildingIds.push(req.currentAdmin.buildingId);
      } else {
        (
          await buildingController.getBuildings({
            propertyId: req.currentAdmin.propertyId,
          })
        ).map((building) => {
          buildingIds.push(building.id);
        });
      }
      const dashboard = await dashboardController.getVisitorAnalyticsGraph(
        { ...req.query, propertyId: req.currentAdmin.propertyId },

        buildingIds
      );

      res.json({
        status: "success",
        data: dashboard,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/visitor-stats";
      next(error);
    }
  }
);

router.get(
  "/maintenance-area/statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const dashboard = await dashboardController.maintenanceAreaStatistics(
        req.validatedQuery,
        req.currentAdmin.propertyId,
        req.currentAdmin.buildingId
      );

      sendResponse(res, dashboard); //message is already set to null
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/maintenance-area/statistics";
      next(error);
    }
  }
);

router.get(
  "/lease-usage-stats",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      dashboard = await dashboardController.getLeaseAnalyticsChart({
        ...req.validatedQuery,
        propertyId: req.currentAdmin.propertyId,
      });

      sendResponse(res, dashboard);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/lease-usage-stats";
      next(error);
    }
  }
);

router.get(
  "/lease-statuses",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      dashboard = await dashboardController.getLeaseAnalytics({
        ...req.validatedQuery,
        propertyId: req.currentAdmin.propertyId,
      });

      sendResponse(res, dashboard);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/lease-statuses";
      next(error);
    }
  }
);

router.get(
  "/lease-types",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getAnalyticsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let dashboard;
      dashboard = await dashboardController.leaseTypeAnalytics({
        ...req.validatedQuery,
        propertyId: req.currentAdmin.propertyId,
      });

      sendResponse(res, dashboard);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /dashboard/lease-types";
      next(error);
    }
  }
);

module.exports = router;
