const router = require("express").Router();
const {
  USER_TYPES,
  ADMIN_ROLES,
  APP_FEATURES,
  MAINTENANCE_REQUESTED_BY,
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
} = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const maintenanceRequestController = require("../controllers/maintenanceRequest");
const adminMaintenanceRequestController = require("../controllers/adminMaintenanceRequest");
const { AppError } = require("../../utils/errorHandler");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const buildingController = require("../../building-service/controllers/building");
const { checkFeature } = require("../../utils/middlewares/checkFeature");
const uploadController = require("../../upload-service/controllers/s3Upload");
const { sanitisePayload } = require("../../utils/utility");
const maintenanceCategoryController = require("../controllers/maintenanceCategory");
const maintenanceProductController = require("../controllers/maintenanceProduct");
const eventEmitter = require("../../utils/eventEmitter");
const ownerRoutes = require("./owner.routes");
const staffRoutes = require("./staff.routes");
const { sendResponse } = require("../../utils/responseHandler");
const {
  calculateSuccessAndFailures,
} = require("../controllers/maintenanceRequest.utility");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  updateFilesOnRequestsSchema,
  getRequestByRequestIdSchema,
  getProductByProductIdSchema,
  updateProductByProductIdSchema,
} = require("../validators");

router.use("/owner", ownerRoutes);
router.use("/staff", authToken(USER_TYPES.STAFF), staffRoutes);

router.get(
  "/statuses/statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const data =
        await adminMaintenanceRequestController.maintenanceRequestStats({
          propertyId: req.currentAdmin.propertyId,
          buildingId: req.query.buildingId,
        });
      if (data) {
        res.status(200).json({
          status: "success",
          data,
        });
      }
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : " GET /maintenances/statistics";
      next(error);
    }
  }
);
//get request types
router.get("/types", async (req, res, next) => {
  try {
    const types = await maintenanceRequestController.getTypes(req.language);
    res.json({
      status: "success",
      data: types,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /maintenances/types";
    next(error);
  }
});

//get maintenance cancel reasons
router.get("/cancel-reasons", async (req, res, next) => {
  try {
    const statuses = await maintenanceRequestController.requestCancelReasons(
      req.language
    );
    res.json({
      status: "success",
      data: statuses,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /maintenances/cancel-reasons";
    next(error);
  }
});

//get maintenance statuses
router.get("/statuses", async (req, res, next) => {
  try {
    const statuses = await maintenanceRequestController.getStatusesList(
      req.language
    );
    res.json({
      status: "success",
      data: statuses,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /maintenances/statuses";
    next(error);
  }
});

//get maintenance statuses based on request
router.get(
  "/statuses/:maintenanceId",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.SERVICE),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const statuses = await maintenanceRequestController.getStatuses(
        { id: req.params.maintenanceId }, //TODO: validate request for admin
        req.language
      );
      res.json({
        status: "success",
        data: statuses,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/statuses/:maintenanceId";
      next(error);
    }
  }
);

//create new maintenance request
router.post(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      const request = await maintenanceRequestController.createRequest(
        {
          ...req.body,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
          generatedBy: MAINTENANCE_REQUESTED_BY.RESIDENT,
        },
        req.currentUser,
        req.language
      );

      eventEmitter.emit("admin_level_notification", {
        flatId: req.currentUser.flatId,
        actionType: ADMIN_ACTION_TYPES.NEW_REQUEST.key,
        sourceType: ADMIN_SOURCE_TYPES.SERVICES,
        sourceId: request.id,
        generatedBy: req.currentUser.id,
      });

      res.json({
        status: "success",
        data: request,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances";
      next(error);
    }
  }
);

//create multiple requests
router.post(
  "/multiple",
  authToken(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      const requests =
        await maintenanceRequestController.createMultipleRequests(
          {
            ...req.body,
            userId: req.currentUser.id,
            flatId: req.currentUser.flatId,
            userName: req.currentUser.name,
            userEmail: req.currentUser.email,
            generatedBy: MAINTENANCE_REQUESTED_BY.RESIDENT,
          },
          req.timezone
        );
      const status = requests.every((data) => data.success)
        ? "success"
        : "fail";
      res.json({
        status,
        data: requests,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/multiple";
      next(error);
    }
  }
);

//create new maintenance request - admin
router.post(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.SERVICE),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const request =
        await adminMaintenanceRequestController.createRequestForFlat(
          {
            ...req.body,
            generatedBy: MAINTENANCE_REQUESTED_BY.ADMIN,
          },
          req.currentAdmin
        );
      res.json({
        status: "success",
        data: request,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/admin";
      next(error);
    }
  }
);

//create multiple requests - admin
router.post(
  "/admin/multiple",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.SERVICE),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const requests = await adminMaintenanceRequestController.createRequests({
        ...req.body,
        adminEmail: req.currentAdmin.email,
        adminName: req.currentAdmin.name,
        generatedBy: MAINTENANCE_REQUESTED_BY.ADMIN,
        propertyId: req.currentAdmin.propertyId,
      });
      const msg = await calculateSuccessAndFailures(requests, "Request");
      sendResponse(res, requests, msg);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/admin";
      next(error);
    }
  }
);

//update a maintenance request
router.patch(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      const updatedRequest = await maintenanceRequestController.updateRequest(
        {
          ...req.body,
          userId: req.currentUser.id,
        },
        req.language
      );
      res.json({
        status: "success",
        data: updatedRequest,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenances";
      next(error);
    }
  }
);

//update request - admin
router.patch(
  "/admin/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await adminMaintenanceRequestController.updateRequestAdmin({
        ...req.body,
        id: req.params.requestId,
        propertyId: req.currentAdmin.propertyId,
        adminId: req.currentAdmin.id,
      });
      sendResponse(res, null, "Request updated successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenances/admin/:requestId";
      next(error);
    }
  }
);

router.patch(
  "/admin/sub-category/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const request =
        await adminMaintenanceRequestController.updateRequestSubCategory({
          id: req.params.requestId,
          subCategoryId: req.body?.subCategoryId,
          propertyId: req.currentAdmin.propertyId,
        });
      res.json({
        status: "success",
        msg: "Sub category updated successfully",
        data: request,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenances/admin/:requestId";
      next(error);
    }
  }
);

//get all maintenance request of a user
router.get(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.SERVICE),
  pagination,
  async (req, res, next) => {
    try {
      const requests = await maintenanceRequestController.getAllRequests(
        {
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
        },
        { ...sanitisePayload(req.query) },
        req.paginate,
        req.language,
        req.timezone
      );
      res.json({
        status: "success",
        data: requests,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /maintenances";
      next(error);
    }
  }
);

//assign staff to a maintenance request
router.post(
  "/assign-staff",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      await adminMaintenanceRequestController.assignStaff(
        req.body,
        req.timezone,
        req.currentAdmin
      );
      sendResponse(res, null, "Staff Assigned successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/assign-staff";
      next(error);
    }
  }
);

//change assigned staff timings
router.patch(
  "/admin/timings/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await adminMaintenanceRequestController.editStaffTimingForRequest({
        ...req.body,
        requestId: req.params.requestId,
      });
      res.json({
        status: "success",
        data: "Slots updated successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenances/admin/timings/:requestId";
      next(error);
    }
  }
);

//remove assigned staff from maintenance request
router.patch(
  "/remove-staff",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      if (!req.body.requestId) {
        throw new AppError("", "Request ID is required", "custom", 412);
      }
      await adminMaintenanceRequestController.removeStaff({
        id: req.body.requestId,
      });
      res.json({
        status: "success",
        data: "Staff removed successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenances/remove-staff";
      next(error);
    }
  }
);

//change status of a request
router.patch(
  "/complete",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      const request =
        await adminMaintenanceRequestController.changeRequestStatus(
          {
            ...req.body,
            adminEmail: req.currentAdmin.email,
            adminId: req.currentAdmin.id,
          },
          req.timezone
        );
      res.json({
        status: "success",
        data: request,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenances/complete";
      next(error);
    }
  }
);

//get all requests - to be viewed by admin
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.SERVICE),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      let params = { ...sanitisePayload(req.query) };
      if (req.currentAdmin.buildingId) {
        params.buildingId = [req.currentAdmin.buildingId];
      } else {
        let buildingIds = [];
        const buildings = await buildingController.getBuildings({
          propertyId: req.currentAdmin.propertyId,
        });
        buildings.map((building) => {
          buildingIds.push(building.id);
        });
        params.buildingId = buildingIds;
      }
      let requests;
      if (params?.tabName && params.tabName == "incomplete") {
        requests =
          await adminMaintenanceRequestController.getIncompleteRequests(
            params,
            req.paginate,
            req.language,
            req.timezone
          );
      } else {
        requests = await adminMaintenanceRequestController.getRequests(
          params,
          req.paginate,
          req.language,
          req.timezone
        );
      }
      res.json({
        status: "success",
        data: requests,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/admin";
      next(error);
    }
  }
);

router.get(
  "/admin/request-count",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let params = { ...sanitisePayload(req.query) };
      if (req.currentAdmin?.buildingId) {
        params.buildingId = [req.currentAdmin.buildingId];
      } else {
        params.buildingId = (
          await buildingController.getBuildings({
            propertyId: req.currentAdmin.propertyId,
          })
        ).map((building) => building.id);
      }

      let requestsCount;
      if (req.query.list && req.query.list == "new") {
        requestsCount =
          await maintenanceRequestController.getRequestCountForAllStatusesWithLabel(
            params,
            req.timezone
          );
      } else {
        console.log("your in admi 6");

        requestsCount =
          await maintenanceRequestController.getRequestCountForAllStatuses(
            params,
            req.timezone
          );
      }
      console.log("your in admi 7");

      res.json({
        status: "success",
        data: requestsCount,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/admin/request-count";
      next(error);
    }
  }
);
router.get(
  "/request-count",
  authToken(USER_TYPES.USER),
  async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const flatId = req.currentUser.flatId;
      const params = { ...sanitisePayload(req.query), userId, flatId };
      const requestsCount =
        await maintenanceRequestController.getRequestCountForAllStatusesForUser(
          params,
          req.timezone
        );
      res.json({
        status: "success",
        data: requestsCount,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/request-count";
      next(error);
    }
  }
);
//Get all categories - admin/user
router.get(
  "/admin/categories/all",
  authToken([USER_TYPES.ADMIN, USER_TYPES.USER]),
  async (req, res, next) => {
    try {
      let categories;
      if (!req.currentAdmin) {
        categories = await maintenanceCategoryController.getCategoriesFromFlat(
          {
            ...sanitisePayload(req.query),
            flatId: req.currentUser.flatId,
            isVisible: true,
          },
          req.language
        );
      } else {
        categories = await maintenanceCategoryController.getCategoriesList(
          {
            ...sanitisePayload(req.query),
            propertyId: req.currentAdmin.propertyId,
          },
          req.language
        );
      }

      res.json({
        status: "success",
        data: categories,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET maintenances/admin/categories/all";
      next(error);
    }
  }
);

//Get all categories - admin
router.get(
  "/admin/categories",
  authToken(USER_TYPES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const categories = await maintenanceCategoryController.getCategories(
        {
          ...sanitisePayload(req.query),
          propertyId: req.currentAdmin.propertyId,
        },
        req.paginate
      );
      res.json({
        status: "success",
        data: categories,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET maintenances/admin/categories";
      next(error);
    }
  }
);

router.get(
  "/admin/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const requestExports =
        await adminMaintenanceRequestController.getMaintenanceRequestWithPropertyForExport(
          req.currentAdmin.propertyId,
          req.query.buildingId,
          req.query.categoryId,
          req.query.search,
          req.query.status,
          req.query.isUrgent,
          req.query.subCategoryId,
          req.query.serviceRequestDate
        );
      res.json({
        status: "success",
        data: requestExports,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/admin/export";
      next(error);
    }
  }
);

//get request details - to be viewed by admin
router.get(
  "/admin/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      const request = await adminMaintenanceRequestController.getRequestDetails(
        { id: req.params.requestId },
        req.language,
        req.timezone
      );
      res.json({
        status: "success",
        data: request,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/admin/:requestId";
      next(error);
    }
  }
);

//get a specific maintenance request
router.get(
  "/:requestId",
  authToken(),
  checkFeature(APP_FEATURES.SERVICE),
  async (req, res, next) => {
    try {
      const request = await maintenanceRequestController.getRequest(
        {
          id: req.params.requestId,
        },
        req.language,
        req.timezone
      );
      res.json({
        status: "success",
        data: request,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/requestId";
      next(error);
    }
  }
);

router.post("/cron/in-process", async (req, res, next) => {
  try {
    const response =
      await adminMaintenanceRequestController.updateRequestStatusCron();
    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /maintenances/cron/in-process";
    next(error);
  }
});

//TODO: deprecate route
router.post(
  "/files/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  uploadController.s3Upload.array("file"),
  async (req, res, next) => {
    try {
      let files;
      if (!req.files || !req.files.length) {
        throw new AppError("", "No files selected", "custom", 422);
      }

      files = await uploadController.uploadFiles(req.files);

      const requestFiles =
        await adminMaintenanceRequestController.addFilesToRequest({
          id: req.params.requestId,
          files,
        });
      res.json({
        status: "success",
        data: requestFiles,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/files/:requestId";
      next(error);
    }
  }
);

// updated route
router.post(
  "/admin/files/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({
    params: getRequestByRequestIdSchema,
    body: updateFilesOnRequestsSchema,
  }),
  async (req, res, next) => {
    try {
      const files = req.validatedBody.files;

      await adminMaintenanceRequestController.addFilesToRequestUpdated({
        id: req.validatedParams.requestId,
        propertyId: req.currentAdmin.propertyId,
        files,
      });
      const msg = `files added successfully`;
      sendResponse(res, null, msg);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/admin/files/:requestId";
      next(error);
    }
  }
);

//create new maintenance category- admin
router.post(
  "/admin/categories",
  authToken(USER_TYPES.ADMIN),
  checkFeature(APP_FEATURES.SERVICE),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const category = await maintenanceCategoryController.createCategory({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST maintenances/admin/categories";
      next(error);
    }
  }
);

//*Get category by id
router.get(
  "/admin/categories/:categoryId",
  authToken(USER_TYPES.ADMIN),
  async (req, res) => {
    try {
      const category = await maintenanceCategoryController.getCategory({
        id: req.params.categoryId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET maintenances/admin/categories/:categoryId";
    }
  }
);
//*Update category by id
router.patch(
  "/admin/categories/:categoryId",
  authToken(USER_TYPES.ADMIN),
  async (req, res, next) => {
    try {
      const category = await maintenanceCategoryController.updateCategory(
        req.body,
        { id: req.params.categoryId, propertyId: req.currentAdmin.propertyId }
      );
      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH maintenances/admin/categories/:categoryId";
      next(error);
    }
  }
);

//*Delete category by id
router.delete(
  "/admin/categories/:categoryId",
  authToken(USER_TYPES.ADMIN),
  async (req, res, next) => {
    try {
      const category = await maintenanceCategoryController.deleteCategory({
        id: req.params.categoryId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE maintenances/admin/categories/:categoryId";
      next(error);
    }
  }
);

//*Toggle feature by id
router.patch(
  "/admin/categories/visibility/:categoryId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const category = await maintenanceCategoryController.toggleVisibility({
        id: req.params.categoryId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH maintenances/admin/categories/visibility/:categoryId";
      next(error);
    }
  }
);

router.patch("/feedback/:requestId", authToken(), async (req, res, next) => {
  try {
    const request = await maintenanceRequestController.submitFeedback(
      {
        ...req.body,
        userId: req.currentUser.id,
        flatId: req.currentUser.flatId,
      },
      req.params.requestId
    );
    res.json({
      status: "success",
      msg: "Feedback successfully submitted",
      data: null,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "PATCH maintenances/feedback/:requestId";
    next(error);
  }
});

router.post(
  "/product/:maintenanceId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const products = await maintenanceProductController.addMaintenanceProduct(
        {
          ...req.body,
          maintenanceId: req.params.maintenanceId,
          adminId: req.currentAdmin.id,
        }
      );
      const msg = await calculateSuccessAndFailures(products, "Product");
      sendResponse(res, products, msg);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/product/:requestId";
      next(error);
    }
  }
);

router
  .route("/product/:productId")
  .delete(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ params: getProductByProductIdSchema }),
    async (req, res, next) => {
      try {
        await maintenanceProductController.removeMaintenanceProduct({
          productId: req.params.productId,
        });
        const msg = `Product deleted successfully`;
        sendResponse(res, null, msg);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "DELETE /maintenances/product/:productId";
        next(error);
      }
    }
  )
  .patch(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({
      params: getProductByProductIdSchema,
      body: updateProductByProductIdSchema,
    }),
    async (req, res, next) => {
      try {
        await maintenanceProductController.updateMaintenanceProduct({
          productId: req.validatedParams.productId,
          ...req.validatedBody,
        });
        const msg = `Product updated successfully`;
        sendResponse(res, null, msg);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /maintenances/product/:productId";
        next(error);
      }
    }
  );

module.exports = router;
