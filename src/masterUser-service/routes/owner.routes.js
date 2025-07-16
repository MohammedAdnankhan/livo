const { Router } = require("express");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getTenantsForOwnerSchema,
  getTenantByIdForOwnerSchema,
  getContractDetailsForOwnerSchema,
} = require("../validators");
const muOwnerController = require("../controllers/ownerMasterUser");
const { sendResponse } = require("../../utils/responseHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { CONTRACT_STATUSES } = require("../../config/constants");

const muOwnerRoutes = Router();

muOwnerRoutes
  .route("/tenants")
  .get(
    pagination,
    validatePayload({ query: getTenantsForOwnerSchema }),
    async (req, res, next) => {
      try {
        const { buildingId, flatId, contractStatus } = req.validatedQuery;

        const params = {
          ownerId: req.currentOwner.id,
          buildingIds: buildingId
            ? [buildingId]
            : req.currentOwner.buildings.map(({ id }) => id),
          flatId,
        };

        let tenants;

        if (contractStatus === CONTRACT_STATUSES.ACTIVE) {
          tenants = await muOwnerController.getActiveTenantsForOwner(
            params,
            req.paginate,
            req.language
          );
        } else {
          tenants = await muOwnerController.getInActiveTenantsForOwner(
            params,
            req.paginate,
            req.language
          );
        }

        sendResponse(res, tenants, "Tenants retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/owner/tenants";
        next(error);
      }
    }
  );

muOwnerRoutes
  .route("/tenants/:id")
  .get(
    validatePayload({ params: getTenantByIdForOwnerSchema }),
    async (req, res, next) => {
      try {
        const { id } = req.validatedParams;

        const params = {
          ownerId: req.currentOwner.id,
          tenantId: id,
        };

        const tenantDetail = await muOwnerController.getTenantDetails(params);

        sendResponse(
          res,
          tenantDetail,
          "Tenant details retrieved successfully"
        );
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/owner/tenants/:id";
        next(error);
      }
    }
  );

//FIXME: route should be in contract service in owner routes file
muOwnerRoutes
  .route("/contracts/:id")
  .get(
    pagination,
    validatePayload({ params: getContractDetailsForOwnerSchema }),
    async (req, res, next) => {
      try {
        const { id } = req.validatedParams;
        const params = {
          ownerId: req.currentOwner.id,
          contractId: id,
        };

        const contractDetail = await muOwnerController.getContractDetails(
          params
        );

        sendResponse(
          res,
          contractDetail,
          "contract details retrieved successfully"
        );
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/owner/contracts/:id";
        next(error);
      }
    }
  );

module.exports = muOwnerRoutes;
