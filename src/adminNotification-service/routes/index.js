const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const AdminNotificationController = require("../controllers/adminNotification");
const PushDeviceController = require("../controllers/adminPushDevice");
const { USER_TYPES } = require("../../config/constants");

//get all notifications of a admin
router.get(
  "/",
  authToken([USER_TYPES.ADMIN]),
  pagination,
  async (req, res, next) => {
    try {
      const notifications = await AdminNotificationController.getNotifications(
        {
          generatedFor: req.currentAdmin.id,
        },
        req.paginate,
        req.language
      );
      res.json({
        status: "success",
        data: notifications,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /notifications";
      next(error);
    }
  }
);

//read notification
router.patch("/", authToken([USER_TYPES.ADMIN]), async (req, res, next) => {
  try {
    if (!req.body.notificationId) {
      throw new AppError("", "Enter notification ID");
    }
    const read = await AdminNotificationController.readNotification({
      generatedFor: req.currentAdmin.id,
      id: req.body.notificationId,
    });
    res.json({
      status: "success",
      msg: "Notification read",
      data: read,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "PATCH /notifications";
    next(error);
  }
});

//check if any unread notifications are there
router.get(
  "/check-unread",
  authToken([USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      const checkStatus = await AdminNotificationController.checkUnread({
        generatedFor: req.currentAdmin.id,
        isRead: false,
      });
      res.json({
        status: "success",
        data: checkStatus,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /notifications/check-unread";
      next(error);
    }
  }
);

//mark all notification as read
router.patch(
  "/read-all",
  authToken([USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      await AdminNotificationController.readAllNotifications({
        generatedFor: req.currentAdmin.id,
        isRead: false,
      });
      res.json({
        status: "success",
        msg: "All notifications has been read",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /notifications/read-all";
      next(error);
    }
  }
);

//push device token to device table
router.post(
  "/add-token",
  authToken([USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      const addToken = await PushDeviceController.sendFcmToken({
        ...req.body,
        adminId: req.currentAdmin.id,
      });
      res.json({
        status: "success",
        data: addToken,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /notifications/add-token";
      next(error);
    }
  }
);

//remove device token
router.post(
  "/remove-token",
  authToken([USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      await PushDeviceController.removeFcmToken({
        ...req.body,
      });
      res.json({
        status: "success",
        data: "Token removed successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /notifications/remove-token";
      next(error);
    }
  }
);

// return count of unread notifications
router.get(
  "/unread-count",
  authToken([USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const interval = setInterval(async () => {
        const unreadNotifications =
          await AdminNotificationController.unreadCount({
            generatedFor: req.currentAdmin.id,
            isRead: false,
          });
        res.write(
          `id: ${new Date().toLocaleTimeString()}\ndata: ${unreadNotifications}\n\n`
        );
      }, 1000);

      req.on("close", () => {
        clearInterval(interval);
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /notifications/unread-count";
      next(error);
    }
  }
);

module.exports = router;
