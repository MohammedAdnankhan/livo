const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const UserNotificationController = require("../controllers/userNotification");
const PushDeviceController = require("../controllers/pushDevice");
const { USER_TYPES } = require("../../config/constants");

//get all notifications of a user
router.get("/", authToken(), pagination, async (req, res, next) => {
  try {
    const notifications = await UserNotificationController.getNotifications(
      {
        generatedFor: req.currentUser.id,
      },
      req.paginate,
      req.language
    );
    res.json({
      status: "success",
      data: notifications,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /notifications";
    next(error);
  }
});

//read notification
router.patch("/", authToken(), async (req, res, next) => {
  try {
    if (!req.body.notificationId) {
      throw new AppError("", "Enter notification ID");
    }
    const read = await UserNotificationController.readNotification({
      generatedFor: req.currentUser.id,
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

//create new notification TODO: might be changed later
// router.post("/", async (req, res, next) => {
//   try {
//     const newNotification =
//       await UserNotificationController.createNewNotification(req.body);
//     res.json({
//       status: "success",
//       data: newNotification,
//     });
//   } catch (error) {
//     error.reference = error.reference ? error.reference : "POST /notifications";
//     next(error);
//   }
// });

//check if any unread notifications are there
router.get("/check-unread", authToken(), async (req, res, next) => {
  try {
    const checkStatus = await UserNotificationController.checkUnread({
      generatedFor: req.currentUser.id,
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
});

//mark all notification as read
router.patch("/read-all", authToken(), async (req, res, next) => {
  try {
    await UserNotificationController.readAllNotifications({
      generatedFor: req.currentUser.id,
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
});

//push device token to device table
router.post("/add-token", authToken(), async (req, res, next) => {
  try {
    const addToken = await PushDeviceController.sendFcmToken({
      ...req.body,
      userId: req.currentUser.id,
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
});

//remove device token
router.post(
  "/remove-token",
  authToken([USER_TYPES.USER, USER_TYPES.GUARD]),
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

module.exports = router;
