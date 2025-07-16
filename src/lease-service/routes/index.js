const { Router } = require("express");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { ADMIN_ROLES, USER_TYPES } = require("../../config/constants");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const leaseController = require("../controllers/lease");
const leaseCronController = require("../controllers/lease.cron");
const adminLeaseRoutes = require("./admin.routes");
const { sendResponse } = require("../../utils/responseHandler");
const logger = require("../../utils/logger");

const leaseRoutes = Router();

leaseRoutes.use(
  "/admin",
  authToken([USER_TYPES.ADMIN]),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  adminLeaseRoutes
);

leaseRoutes.route("/my").get(authToken(), async (req, res, next) => {
  try {
    const lease = await leaseController.getLeaseForResident(
      {
        mobileNumber: req.currentUser.mobileNumber,
      },
      req.timezone
    );
    sendResponse(res, lease, "Lease retrieved successfully");
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /leases/my";
    next(error);
  }
});

leaseRoutes.route("/cron/expire-leases").get(async (req, res, next) => {
  try {
    const lease = await leaseCronController.expireLeasesCron();
    logger.info(`${lease} expired!`);
    sendResponse(res, null, "Lease status updated successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /leases/cron/expire-leases";
    next(error);
  }
});

module.exports = leaseRoutes;
