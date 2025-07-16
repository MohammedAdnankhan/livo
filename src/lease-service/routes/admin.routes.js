const { Router } = require("express");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");
const {
  createLeaseSchema,
  getLeasesSchema,
  getLeaseByLeaseIdSchema,
  changeLeaseStatusForAdminSchema,
  updateLeaseDraftSchema,
  getLeasesExportsSchema,
  getLeaseStatisticsSchema,
  terminateLeaseSchema,
} = require("../validators");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const leaseStatController = require("../controllers/lease.analytics");
const leaseController = require("../controllers/lease");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");

const adminLeaseRoutes = Router();

adminLeaseRoutes.route("/export").get(
  validatePayload({
    query: getLeasesExportsSchema,
  }),
  async (req, res, next) => {
    try {
      const params = {
        ...req.validatedQuery,
        propertyId: req.currentAdmin.propertyId,
      };
      const leases = await leaseController.getLeaseExportsForAdmin(params);
      sendResponse(res, leases, "Leases retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /leases/admin/export";
      next(error);
    }
  }
);
adminLeaseRoutes.route("/statistics").get(
  validatePayload({
    query: getLeaseStatisticsSchema,
  }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const params = {
        ...req.validatedQuery,
        propertyId: req.currentAdmin.propertyId,
      };
      const leases = await leaseStatController.leaseStats(params);
      sendResponse(res, leases, "Leases retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /leases/admin/statistics";
      next(error);
    }
  }
);

adminLeaseRoutes
  .route("/")
  .post(
    validatePayload({ body: createLeaseSchema }),
    async (req, res, next) => {
      try {
        await leaseController.createLeaseDraft(
          req.validatedBody,
          req.currentAdmin.propertyId
        );
        sendResponse(res, null, "Lease draft created successfully", 201);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /leases/admin";
        next(error);
      }
    }
  )
  .get(
    pagination,
    validatePayload({ query: getLeasesSchema }),
    async (req, res, next) => {
      try {
        const params = {
          ...req.validatedQuery,
          propertyId: req.currentAdmin.propertyId,
        };
        const leases = await leaseController.getLeasesForAdmin(
          params,
          req.paginate
        );
        sendResponse(res, leases, "Leases retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /leases/admin";
        next(error);
      }
    }
  );

adminLeaseRoutes
  .route("/status")
  .post(
    validatePayload({ body: changeLeaseStatusForAdminSchema }),
    async (req, res, next) => {
      try {
        await leaseController.changeLeaseStatusForAdmin({
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        });

        sendResponse(
          res,
          null,
          `Lease marked as ${req.validatedBody["status"]}`
        );
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /leases/admin/status";
        next(error);
      }
    }
  );

adminLeaseRoutes
  .route("/terminate")
  .post(
    validatePayload({ body: terminateLeaseSchema }),
    async (req, res, next) => {
      try {
        await leaseController.terminateLeaseForAdmin({
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, null, "Lease terminated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /leases/admin/terminate";
        next(error);
      }
    }
  );

adminLeaseRoutes
  .route("/:leaseId")
  .get(
    validatePayload({ params: getLeaseByLeaseIdSchema }),
    async (req, res, next) => {
      try {
        const lease = await leaseController.getLeaseDetailsForAdmin({
          leaseId: req.validatedParams.leaseId,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, lease, "Lease retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /leases/admin/:leaseId";
        next(error);
      }
    }
  )
  .patch(
    validatePayload({
      params: getLeaseByLeaseIdSchema,
      body: updateLeaseDraftSchema,
    }),
    async (req, res, next) => {
      try {
        const params = {
          leaseId: req.validatedParams.leaseId,
          propertyId: req.currentAdmin.propertyId,
        };

        await leaseController.updateLeaseDraftForAdmin(
          params,
          req.validatedBody
        );
        sendResponse(res, null, "Lease Draft updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /leases/admin/:leaseId";
        next(error);
      }
    }
  );

module.exports = adminLeaseRoutes;
