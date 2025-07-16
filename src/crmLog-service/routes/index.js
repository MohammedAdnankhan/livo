const router = require("express").Router();
const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { sendResponse } = require("../../utils/responseHandler");
const crmController = require("../controllers/crmLog");

router.get(
  "/sales-managers",
  authToken(USER_TYPES.GUARD),
  async (req, res, next) => {
    try {
      const salesManagers = await crmController.getSalesManagers({
        propertyId: req.currentGuard.propertyId,
      });
      sendResponse(res, salesManagers);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /crm/sales-managers";
      next(error);
    }
  }
);

router.get("/brokers", authToken(USER_TYPES.GUARD), async (req, res, next) => {
  try {
    const brokers = await crmController.getBrokers({
      propertyId: req.currentGuard.propertyId,
    });
    sendResponse(res, brokers);
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /crm/brokers";
    next(error);
  }
});

router.get(
  "/sobha-connect",
  authToken(USER_TYPES.GUARD),
  async (req, res, next) => {
    try {
      const brokers = await crmController.getConnectBrokers({
        propertyId: req.currentGuard.propertyId,
      });
      sendResponse(res, brokers);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /crm/sobha-connect";
      next(error);
    }
  }
);

module.exports = router;
