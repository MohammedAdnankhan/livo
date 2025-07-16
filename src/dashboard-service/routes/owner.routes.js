const { Router } = require("express");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");
const ownerDashboardController = require("../../dashboard-service/controllers/ownerDashboard");
const ownerRoutes = Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { USER_TYPES } = require("../../config/constants");
const { getOwnerStatisticsSchema } = require("../validators");
const validateOwnerBuildingAccess = require("../../utils/middlewares/validateOwnerBuildingAccess");

ownerRoutes.route("/statistics").get(
  validateOwnerBuildingAccess("query", (isRequired = false)),
  validatePayload({ query: getOwnerStatisticsSchema }),

  async (req, res, next) => {
    try {
      const statistics = await ownerDashboardController.getStatistics({
        buildings: req.currentOwner.buildings,
        buildingId: req.validatedQuery.buildingId,
        ownerId: req.currentOwner.id,
      });

      sendResponse(res, statistics, "stats retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
);
module.exports = ownerRoutes;
