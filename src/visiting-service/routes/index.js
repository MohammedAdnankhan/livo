const express = require("express");
const { errorHandler, AppError } = require("../../utils/errorHandler");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const visitingController = require("./../controllers/visiting");
const visitingStatusController = require("./../controllers/visitingStatus");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { formGroupOfIds } = require("../../flat-service/utils/flat.utility");
const {
  USER_TYPES,
  ADMIN_ROLES,
  APP_FEATURES,
} = require("../../config/constants");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { getFlat } = require("../../flat-service/controllers/flat");
const {
  validateBuildingIdForAdmin,
  validateBuildingForGuard,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { getBuilding } = require("../../building-service/controllers/building");
const { checkFeature } = require("../../utils/middlewares/checkFeature");
const { sanitisePayload } = require("../../utils/utility");
const { sendResponse } = require("../../utils/responseHandler");
const {
  getVisitorLogsSchema,
  getVisitorLogsNewSchema,
} = require("../validators");
const {
  getPropertyFromFlat,
} = require("../../property-service/controllers/property");
const router = express.Router();

router.get(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  pagination,
  async (req, res, next) => {
    try {
      let visitings;
      if (req.query.list && req.query.list === "new") {
        delete req.query.list;
        visitings = await visitingController.getVisitingsLatest(
          {
            ...sanitisePayload(req.query),
            flatId: req.currentUser.flatId,
          },
          [],
          req.paginate,
          req.timezone
        );
      } else {
        visitings = await visitingController.getVisitings(
          {
            ...sanitisePayload(req.query),
            flatId: req.currentUser.flatId,
          },
          [],
          req.paginate,
          req.timezone
        );
      }

      res.json({
        status: "success",
        data: visitings,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /visitings";
      next(error);
    }
  }
);

router.get(
  "/all",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  pagination,
  async (req, res, next) => {
    try {
      let visitings = await visitingController.getVisitingsLatestNew(
        {
          ...sanitisePayload(req.query),
          flatId: req.currentUser.flatId,
        },
        [],
        req.paginate,
        req.timezone
      );
      sendResponse(res, visitings);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/all";
      next(error);
    }
  }
);

router.get("/purchase-purposes", (req, res, next) => {
  try {
    res.json({
      status: "success",
      data: visitingController.getPurchasePurposes(),
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitings/purchase-purposes";
  }
});

router.get("/viewing-sources", (req, res, next) => {
  try {
    res.json({
      status: "success",
      data: visitingController.getViewingSources(),
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitings/viewing-sources";
  }
});

router.get("/property-interested-in", (req, res, next) => {
  try {
    res.json({
      status: "success",
      data: visitingController.getPropertyInterestedIn(),
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitings/property-interested-in";
  }
});

router.get("/viewing-data", (req, res, next) => {
  try {
    res.json({
      status: "success",
      data: {
        viewingSources: visitingController.getViewingSources(),
        propertyInterestedIn: visitingController.getPropertyInterestedIn(),
        purchasePurposes: visitingController.getPurchasePurposes(),
      },
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitings/viewing-data";
  }
});

router.get("/sobha/viewing-data", (req, res, next) => {
  try {
    sendResponse(
      res,
      {
        viewingSources: visitingController.getViewingSources(),
        walkInSources: visitingController.getWalkInSources(),
        propertyInterestedIn: visitingController.getPropertyInterestedIn(),
        purchasePurposes: visitingController.getPurchasePurposes(),
        indicativeBudget: visitingController.getIndicativeBudgets(),
        possessionTimeline: visitingController.getPossessionTimeline(),
        products: visitingController.getProducts(),
        propertyTypes: visitingController.getPropertyTypes(),
      },
      null
    );
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitings/sobha/viewing-data";
  }
});

router.get("/sobha/nationalities", (req, res, next) => {
  try {
    sendResponse(res, visitingController.getNationalities(), null);
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitings/sobha/nationalities";
  }
});

router.post(
  "/preapproved/guest",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const visiting = await visitingController.createPreApprovedGuest(
        {
          ...req.body,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
          residentName: req.currentUser.name,
        },
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: visiting,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/preapproved/guest";
      next(error);
    }
  }
);

router.post(
  "/preapproved/new/guest",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const property = await getPropertyFromFlat(req.currentUser.flatId);
      const visiting = await visitingController.createPreApprovedGuestNew(
        {
          ...req.body,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
          residentName: req.currentUser.name,
          propertyId: property.id,
        },
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: visiting,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/preapproved/new/guest";
      next(error);
    }
  }
);

//update pre approved visiting Non Guest
router.patch(
  "/preapproved/other/:visitingId",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response =
        await visitingController.updateNonGuestPreapprovedVisiting(
          { id: req.params.visitingId, residentId: req.currentUser.id },
          req.body,
          req.timezone,
          req.language
        );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitings/preapproved/other/:visitingId";
      next(error);
    }
  }
);

//update pre approved visiting Non Guest
router.patch(
  "/preapproved/new/other/:visitingId",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const property = await getPropertyFromFlat(req.currentUser.flatId);
      const response =
        await visitingController.updateNonGuestPreapprovedVisitingNew(
          { id: req.params.visitingId, residentId: req.currentUser.id },
          req.body,
          property.id,
          req.timezone,
          req.language
        );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitings/preapproved/new/other/:visitingId";
      next(error);
    }
  }
);

router.post(
  "/preapproved/other",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) throw new AppError("", "Invalid Body");

      const visitings =
        await visitingController.createNonGuestPreapprovedVisitings(
          {
            dataArr: req.body,
            userId: req.currentUser.id,
            flatId: req.currentUser.flatId,
          },
          req.timezone,
          req.language
        );
      const condition = (data) => data.sucess;
      const status = visitings.every(condition) ? "success" : "fail";
      res.json({
        status,
        data: visitings,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/preapproved/other";
      next(error);
    }
  }
);

router.post(
  "/preapproved/new/other",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) throw new AppError("", "Invalid Body");
      const property = await getPropertyFromFlat(req.currentUser.flatId);
      const visitings =
        await visitingController.createNonGuestPreapprovedVisitingsNew(
          {
            dataArr: req.body,
            userId: req.currentUser.id,
            flatId: req.currentUser.flatId,
          },
          property.id,
          req.timezone,
          req.language
        );
      const condition = (data) => data.sucess;
      const status = visitings.every(condition) ? "success" : "fail";
      res.json({
        status,
        data: visitings,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/preapproved/new/other";
      next(error);
    }
  }
);

router.patch(
  "/preapproved/new/guest/:visitingId",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const property = await getPropertyFromFlat(req.currentUser.flatId);
      const response = await visitingController.updatePreapprovedGuestNew(
        { id: req.params.visitingId, residentId: req.currentUser.id },
        req.body,
        property.id,
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitings/preapproved/guest/:visitingId";
      next(error);
    }
  }
);

router.patch(
  "/preapproved/guest/:visitingId",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response = await visitingController.updatePreapprovedGuest(
        { id: req.params.visitingId, residentId: req.currentUser.id },
        req.body,
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitings/preapproved/guest/:visitingId";
      next(error);
    }
  }
);

router.post(
  "/status",
  authToken(USER_TYPES.GUARD),
  checkFeature(APP_FEATURES.VISITOR),
  validateBuildingForGuard,
  async (req, res, next) => {
    try {
      const { visitingId, status } = req.body;
      if (!req.query.buildingId) {
        throw new AppError("", "Building ID is required");
      }

      const visitingDetails =
        await visitingStatusController.validateGuardIdForVisiting({
          visitingId,
          guardBuildingId: req.query.buildingId,
        });

      const visitingStatus =
        await visitingStatusController.updateVisitingStatus({
          visitingId,
          guardId: req.currentGuard.id,
          status,
          flatId: visitingDetails.flat.id,
        });

      res.json({
        status: "sucess",
        data: visitingStatus,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/status";
      next(error);
    }
  }
);

router.get(
  "/status/:visitingId",
  authToken([USER_TYPES.GUARD, USER_TYPES.USER]),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const statusDetails = await visitingStatusController.getCurrentStatus(
        req.params.visitingId
      );

      res.json({
        status: "success",
        data: statusDetails,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/status/:visitingId";
      next(error);
    }
  }
);

router.get(
  "/statistics/:buildingId",
  authToken([USER_TYPES.GUARD]),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const statistics = await visitingController.getVisitingStatisticsForGuard(
        { guardId: req.currentGuard.id, buildingId: req.params.buildingId }
      );

      res.json({
        status: "success",
        data: statistics,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/statistics/:buildingId";
      next(error);
    }
  }
);

router.get(
  "/preapproved/:visitingId/share-details",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response = await visitingController.getPreapprovedVisitingShareInfo(
        { flatId: req.currentUser.flatId, id: req.params.visitingId },
        req.timezone,
        req.language
      );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/preapproved/:visitingId/share-details";
      next(error);
    }
  }
);

router.delete(
  "/:visitingId",
  authToken(),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response = await visitingController.deleteVisiting({
        id: req.params.visitingId,
        residentId: req.currentUser.id,
      });

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /visitings/:visitingId";
      next(error);
    }
  }
);

router.get(
  "/preapproved/guest/:visitorCode",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response = await visitingController.getPreapprovedVisitingsByCode(
        {
          visitorCode: req.params.visitorCode,
          propertyId: req.currentGuard.propertyId,
        },
        req.timezone,
        req.language
      );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/preapproved/guest/:visitorCode";
      next(error);
    }
  }
);

router.post(
  "/anonymous/guest",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      let response;
      //check added to maintain backward compatibility in prod
      if (!req.body.flats) {
        response = await visitingController.createAnonymousGuest({
          ...req.body,
          guardId: req.currentGuard.id,
        });
      } else {
        response = await visitingController.createAnonymousGuestMultiple({
          ...req.body,
          guardId: req.currentGuard.id,
          propertyId: req.currentGuard.propertyId,
        });
      }

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/anonymous/guest";
      next(error);
    }
  }
);

router.post(
  "/anonymous/new/guest",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      let response;
      //check added to maintain backward compatibility in prod
      if (!req.body.flats) {
        response = await visitingController.createAnonymousGuestNew({
          ...req.body,
          guardId: req.currentGuard.id,
          propertyId: req.currentGuard.propertyId,
        });
      } else {
        response = await visitingController.createAnonymousGuestMultipleNew({
          ...req.body,
          guardId: req.currentGuard.id,
          propertyId: req.currentGuard.propertyId,
        });
      }

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/anonymous/new/guest";
      next(error);
    }
  }
);

router.post(
  "/anonymous/other",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response = await visitingController.createAnonymousNonGuest({
        ...req.body,
        guardId: req.currentGuard.id,
      });

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/anonymous/other";
      next(error);
    }
  }
);

router.get(
  "/last-status/:status",
  authToken(USER_TYPES.GUARD),
  checkFeature(APP_FEATURES.VISITOR),
  pagination,
  async (req, res, next) => {
    try {
      const response =
        await visitingController.getVisitingsByLastStatusesForGuard(
          {
            ...req.query,
            guardId: req.currentGuard.id,
            status: req.params.status,
          },
          req.paginate,
          req.language
        );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/last-status/:status";
      next(error);
    }
  }
);

router.get(
  "/history",
  authToken(USER_TYPES.GUARD),
  checkFeature(APP_FEATURES.VISITOR),
  pagination,
  async (req, res, next) => {
    try {
      const history = await visitingController.getVisitingsHistoryForGuard(
        {
          ...sanitisePayload(req.query),
          guardId: req.currentGuard.id,
        },
        req.paginate,
        req.language,
        req.timezone
      );
      res.json({
        status: "success",
        data: history,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/history";
      next(error);
    }
  }
);

router.get(
  "/requested",
  authToken(USER_TYPES.GUARD),
  checkFeature(APP_FEATURES.VISITOR),
  pagination,
  async (req, res, next) => {
    try {
      const response = await visitingController.getRequestedVisitorsForGuard(
        {
          buildingId: req.query?.buildingId,
          search: req.query?.search,
          guardId: req.currentGuard.id,
        },
        req.paginate,
        req.language
      );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/requested";
      next(error);
    }
  }
);

router.get(
  "/logs",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.VISITOR),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  pagination,
  formGroupOfIds,
  validatePayload({ query: getVisitorLogsSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let response;
      if (req.currentAdmin.buildingId) {
        req.currentAdmin.buildingId = req.validatedQuery.buildingId;
        response = await visitingController.getVisitingLogs(
          {
            ...sanitisePayload(req.validatedQuery),
            buildingId: req.currentAdmin.buildingId,
          },
          req.paginate,
          req.timezone
        );
      } else {
        response = await visitingController.getVisitingLogsOfProperty(
          {
            ...sanitisePayload(req.validatedQuery),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate,
          req.timezone
        );
      }

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/logs";
      next(error);
    }
  }
);

router.get(
  "/all-logs",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.VISITOR),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  pagination,
  formGroupOfIds,
  validatePayload({ query: getVisitorLogsNewSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let response;
      if (req.currentAdmin.buildingId) {
        req.currentAdmin.buildingId = req.validatedQuery.buildingId;
        response = await visitingController.getVisitingLogsNew(
          {
            ...sanitisePayload(req.validatedQuery),
            buildingId: req.currentAdmin.buildingId,
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate,
          req.timezone
        );
      } else {
        response = await visitingController.getVisitingLogsOfPropertyNew(
          {
            ...sanitisePayload(req.validatedQuery),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate,
          req.timezone
        );
      }

      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/all-logs";
      next(error);
    }
  }
);

router.get(
  "/preapproved/:flatId",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  pagination,
  async (req, res, next) => {
    try {
      const flat = await getFlat({ id: req.params.flatId });
      const propertyId = (await getBuilding({ id: flat.buildingId }))
        .propertyId;
      if (propertyId !== req.currentGuard.propertyId)
        throw new AppError("", "Permission Denied!", "custom", 403);

      const response = await visitingController.getPreapprovedVisitingsByFlat(
        { ...req.query, flatId: flat.id },
        req.paginate,
        req.language
      );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/preapproved/:flatId";
      next(error);
    }
  }
);

router.get(
  "/:visitingId",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const details = await visitingController.getVisitingDetails({
        visitingId: req.params.visitingId,
      });
      res.json({
        status: "success",
        data: details,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/:visitingId";
      next(error);
    }
  }
);

router.patch(
  "/status/:visitingId",
  authToken(USER_TYPES.USER),
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const { visitingId } = req.params;

      const visitingStatus =
        await visitingStatusController.approvedOrDenyVisitor({
          visitingId,
          status,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
        });

      res.json({
        status: "sucess",
        data: visitingStatus,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitings/status";
      next(error);
    }
  }
);

router.get(
  "/status-with-details/:visitingId",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response =
        await visitingController.getVisitingDetailWithLastStatusAndResident(
          {
            visitingId: req.params.visitingId,
            propertyId: req.currentGuard.propertyId,
          },
          req.language
        );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /status-with-details/:visitingId";
      next(error);
    }
  }
);

router.patch(
  "/visitor/:visitingId",
  authToken(USER_TYPES.GUARD),
  checkFeature(APP_FEATURES.VISITOR),
  validateBuildingForGuard,
  async (req, res, next) => {
    try {
      if (!req.query.buildingId) {
        throw new AppError("", "buildingId is required in query");
      }
      const response = await visitingController.addOrUpdateVisitorInVisiting(
        {
          visitingId: req.params.visitingId,
          guardBuildingId: req.query.buildingId,
        },
        req.body
      );

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "visitings/visitor/:visitingId";
      next(error);
    }
  }
);

router.post("/cron/auto-checkout", async (req, res, next) => {
  try {
    const resp = await visitingStatusController.autoCheckOutCron();
    res.json({
      status: "success",
      data: resp,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "visitings/cron/auto-checkout";
    next(error);
  }
});

router.get(
  "/admin/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  formGroupOfIds,
  validatePayload({ query: getVisitorLogsSchema }),
  async (req, res, next) => {
    try {
      const visitingExports =
        await visitingController.getVisitingWithPropertyForExport(
          {
            propertyId: req.currentAdmin.propertyId,
            ...req.validatedQuery,
          },
          req.timezone
        );
      sendResponse(res, visitingExports);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/admin/export";
      next(error);
    }
  }
);

router.get(
  "/admin/all-export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  formGroupOfIds,
  validatePayload({ query: getVisitorLogsNewSchema }),
  async (req, res, next) => {
    try {
      const visitingExports =
        await visitingController.getVisitingWithPropertyForExportNew(
          {
            propertyId: req.currentAdmin.propertyId,
            ...req.validatedQuery,
          },
          req.timezone
        );
      sendResponse(res, visitingExports);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitings/admin/all-export";
      next(error);
    }
  }
);

module.exports = router;
