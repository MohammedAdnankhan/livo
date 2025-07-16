const { Router } = require("express");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  createMasterUserSchema,
  getMasterUsersSchemaForAdmin,
  getUserByMasterUserIdSchema,
  updateMasterUserSchema,
} = require("../validators");
const muController = require("../controllers/masterUser");
const { sendResponse } = require("../../utils/responseHandler");
const muAdminCompanyRoutes = require("./admin.company.routes");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");

const muAdminRoutes = Router();

muAdminRoutes.use("/companies", muAdminCompanyRoutes);

muAdminRoutes
  .route("/")
  .post(
    validatePayload({ body: createMasterUserSchema }),
    async (req, res, next) => {
      try {
        const payload = {
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        };
        await muController.createMasterUserV2(payload);
        sendResponse(res, null, `User created successfully`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /master-users/admin";
        next(error);
      }
    }
  )
  .get(
    validateBuildingIdForAdmin,
    pagination,
    validatePayload({ query: getMasterUsersSchemaForAdmin }),
    async (req, res, next) => {
      try {
        const users = await muController.countAndGetUsers(
          { ...req.validatedQuery, propertyId: req.currentAdmin.propertyId },
          req.paginate
        );
        sendResponse(res, users, "Users retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/admin";
        next(error);
      }
    }
  );

muAdminRoutes.route("/potential-tenants").get(async (req, res, next) => {
  try {
    const potentialTenants = await muController.getPotentialTenantsDropdown(
      req.currentAdmin.propertyId
    );

    sendResponse(
      res,
      potentialTenants,
      "Potential tenants retrieved successfully"
    );
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /master-users/admin/potential-tenants";
    next(error);
  }
});

muAdminRoutes.route("/all").get(async (req, res, next) => {
  try {
    const users = await muController.getAllUsersDropdown(
      req.currentAdmin.propertyId
    );

    sendResponse(res, users, "Users retrieved successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /master-users/admin/all";
    next(error);
  }
});

muAdminRoutes.route("/list/all").get(async (req, res, next) => {
  try {
    const users = await muController.getUsersDropDown({
      propertyId: req.currentAdmin.propertyId,
    });

    sendResponse(res, users, "Users retrieved successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /master-users/admin/list/all";
    next(error);
  }
});

muAdminRoutes
  .route("/:masterUserId")
  .get(
    validatePayload({ params: getUserByMasterUserIdSchema }),
    async (req, res, next) => {
      try {
        const payload = {
          id: req.validatedParams.masterUserId,
          propertyId: req.currentAdmin.propertyId,
        };
        const user = await muController.getUserDetails(payload);
        sendResponse(res, user, "User retrieved successful");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/admin/:masterUserId";
        next(error);
      }
    }
  )
  .patch(
    validatePayload({
      params: getUserByMasterUserIdSchema,
      body: updateMasterUserSchema,
    }),
    async (req, res, next) => {
      try {
        const params = {
          id: req.validatedParams.masterUserId,
          propertyId: req.currentAdmin.propertyId,
        };
        await muController.updateMasterUser(params, req.validatedBody);
        sendResponse(res, null, "User updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /master-users/admin/:masterUserId";
        next(error);
      }
    }
  )
  .delete(
    validatePayload({ params: getUserByMasterUserIdSchema }),
    async (req, res, next) => {
      try {
        const payload = {
          id: req.validatedParams.masterUserId,
          propertyId: req.currentAdmin.propertyId,
        };
        await muController.deleteMasterUser(payload);
        sendResponse(res, null, "User deleted successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "DELETE /master-users/admin/:masterUserId";
        next(error);
      }
    }
  );

module.exports = muAdminRoutes;
