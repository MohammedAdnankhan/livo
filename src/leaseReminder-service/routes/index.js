const { Router } = require("express");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const leaseReminderController = require("../controllers/lease.reminder");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  createLeaseReminderSchema,
  getLeaseRemindersSchema,
  instantLeaseReminderSchema,
} = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");

const leaseReminderRouter = Router();

leaseReminderRouter
  .route("/")
  .post(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ body: createLeaseReminderSchema }),
    async (req, res, next) => {
      try {
        await leaseReminderController.addReminder(req.validatedBody);
        sendResponse(res, null, `Reminders created`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /lease-reminders";
        next(error);
      }
    }
  )
  .get(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    pagination,
    validatePayload({ query: getLeaseRemindersSchema }),
    async (req, res, next) => {
      try {
        const data = await leaseReminderController.getReminders(
          {
            ...req.validatedQuery,
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
        sendResponse(res, data, `Reminders fetched successfully`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /lease-reminders";
        next(error);
      }
    }
  );

leaseReminderRouter.route("/cron").post(async (req, res, next) => {
  try {
    const data = await leaseReminderController.sendLeaseExpiryRemindersCron();
    sendResponse(res, data, `reminder cron successful`);
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /lease-reminders/cron";
    next(error);
  }
});

leaseReminderRouter
  .route("/single")
  .post(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ body: instantLeaseReminderSchema }),
    async (req, res, next) => {
      try {
        await leaseReminderController.addInstantReminder(req.validatedBody);
        sendResponse(res, null, `Reminder created`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /lease-reminders/single";
        next(error);
      }
    }
  );

module.exports = leaseReminderRouter;
