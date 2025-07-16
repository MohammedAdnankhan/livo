const { Router } = require("express");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { USER_TYPES } = require("../../config/constants");
const ownerMaintenanceRequestController = require("../controllers/ownerMaintenanceRequest");
const { sendResponse } = require("../../utils/responseHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getOwnerRequestsSchema,
  getRequestCategoriesByFlatSchema,
  createMultipleRequestsSchema,
  cancelRequestSchema,
  updateRequestSchema,
  feedbackRequestSchema,
  flatIdValidationSchema,
  maintenanceIdValidationSchema,
  getRequestStatusesCountSchema,
} = require("../validators");
const validateOwnerFlatAccess = require("../../utils/middlewares/validateOwnerFlatAccess");
const ownerRoutes = Router();

ownerRoutes
  .route("/")
  .get(
    authToken([USER_TYPES.OWNER]),
    pagination,
    validatePayload({ query: getOwnerRequestsSchema }),
    async (req, res, next) => {
      try {
        const requests =
          await ownerMaintenanceRequestController.getMaintenanceRequestsForOwner(
            { ...req.validatedQuery, buildings: req.currentOwner.buildings },
            req.paginate,
            req.language,
            req.timezone
          );

        sendResponse(res, requests, "Requests retrieved successfully");
      } catch (error) {
        next(error);
      }
    }
  );

ownerRoutes.get(
  "/categories",
  authToken([USER_TYPES.OWNER]),
  validatePayload({ query: getRequestCategoriesByFlatSchema }),
  async (req, res, next) => {
    try {
      const { flatId } = req.validatedQuery;
      const categories =
        await ownerMaintenanceRequestController.getMaintenanceCategoriesForOwner(
          { flatId, ownerBuildings: req.currentOwner.buildings },
          req.language
        );

      sendResponse(res, categories, "Categories retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/owner/categories";
      next(error);
    }
  }
);

ownerRoutes.post(
  "/multiple",
  authToken([USER_TYPES.OWNER]),
  validateOwnerFlatAccess(true, "body"),
  validatePayload({ body: createMultipleRequestsSchema }),
  async (req, res, next) => {
    try {
      const requestsArray =
        await ownerMaintenanceRequestController.createMultipleMaintenanceForOwner(
          req.validatedBody
        );
      sendResponse(res, requestsArray, "Request(s) created successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/owner/multiple";
      next(error);
    }
  }
);

ownerRoutes.post(
  "/cancel-request",
  authToken([USER_TYPES.OWNER]),
  validateOwnerFlatAccess(true, "body"),
  validatePayload({ body: cancelRequestSchema }),
  async (req, res, next) => {
    try {
      await ownerMaintenanceRequestController.cancelRequest(req.validatedBody);
      sendResponse(res, null, "Request cancelled successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/owner/cancel-request";
      next(error);
    }
  }
);

ownerRoutes.post(
  "/feedback",
  authToken([USER_TYPES.OWNER]),
  validateOwnerFlatAccess(true, "body"),
  validatePayload({ body: feedbackRequestSchema }),
  async (req, res, next) => {
    try {
      await ownerMaintenanceRequestController.requestFeedback(
        req.validatedBody
      );
      sendResponse(res, null, "Feedback added successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenances/owner/feedback";
      next(error);
    }
  }
);

ownerRoutes
  .route("/status-count")
  .get(
    authToken([USER_TYPES.OWNER]),
    validatePayload({ query: getRequestStatusesCountSchema }),
    async (req, res, next) => {
      try {
        const statusesCount =
          await ownerMaintenanceRequestController.getRequestStatusesCount({
            ...req.validatedQuery,
            buildings: req.currentOwner.buildings,
          });

        sendResponse(
          res,
          statusesCount,
          "Statuses count retrieved successfully"
        );
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /maintenances/owner/status-count";
        next(error);
      }
    }
  );

ownerRoutes
  .route("/:maintenanceId")
  .get(
    authToken([USER_TYPES.OWNER]),
    validateOwnerFlatAccess(true, "query"),
    validatePayload({
      query: flatIdValidationSchema,
      params: maintenanceIdValidationSchema,
    }),
    async (req, res, next) => {
      try {
        const payload = {
          id: req.validatedParams.maintenanceId,
          flatId: req.validatedQuery.flatId,
        };
        const request =
          await ownerMaintenanceRequestController.getRequestForOwner(
            payload,
            req.timezone,
            req.language
          );
        sendResponse(res, request, "Request retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /maintenances/owner/:maintenanceId";
        next(error);
      }
    }
  )
  .patch(
    authToken([USER_TYPES.OWNER]),
    validateOwnerFlatAccess(true, "body"),
    validatePayload({
      params: maintenanceIdValidationSchema,
      body: updateRequestSchema,
    }),
    async (req, res, next) => {
      try {
        await ownerMaintenanceRequestController.updateRequest({
          ...req.validatedBody,
          requestId: req.validatedParams.maintenanceId,
        });
        sendResponse(res, null, "Request updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /maintenances/owner/:maintenanceId";
        next(error);
      }
    }
  );

module.exports = ownerRoutes;
