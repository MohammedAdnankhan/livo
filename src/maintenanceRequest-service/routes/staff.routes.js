const router = require("express").Router();
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");
const {
  getAssignedRequests,
  getAssignRequestById,
} = require("../controllers/staffMaintenanceRequest");
const {
  getAssignedRequestsSchema,
  getAssignedRequestByIdSchema,
} = require("../validators");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");

const staffRoutes = router;

//get assigned requests
staffRoutes.get(
  "/assigned-requests",
  pagination,
  validatePayload({ query: getAssignedRequestsSchema }),
  async (req, res, next) => {
    try {
      const requests = await getAssignedRequests(
        {
          ...req.validatedQuery,
          staffId: req.currentStaff.id,
        },
        req.paginate
      );
      sendResponse(res, requests, "requests fetched successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/staff/assigned-requests";
      next(error);
    }
  }
);

//get assigned request
staffRoutes.get(
  "/assigned-request/:requestId",
  validatePayload({ params: getAssignedRequestByIdSchema }),
  async (req, res, next) => {
    try {
      const requests = await getAssignRequestById(
        {
          ...req.validatedParams,
          staffId: req.currentStaff.id,
        },
        req.paginate
      );
      sendResponse(res, requests, "request fetched successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenances/staff/assigned-request/:requestId";
      next(error);
    }
  }
);
module.exports = staffRoutes;
