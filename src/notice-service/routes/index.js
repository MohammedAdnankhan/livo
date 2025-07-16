const router = require("express").Router();
const { AppError } = require("../../utils/errorHandler");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const noticeController = require("../controllers/notice");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { sanitisePayload } = require("../../utils/utility");
const { sendResponse } = require("../../utils/responseHandler");
const ownerNoticeRoutes = require("./owner.routes");

router.use("/owner", authToken([USER_TYPES.OWNER]), ownerNoticeRoutes);

//get notices
router.get("/", authToken(), pagination, async (req, res, next) => {
  try {
    const notices = await noticeController.getNotices(
      {
        ...req.query,
        userId: req.currentUser.id,
        flatId: req.currentUser.flatId,
      },
      req.paginate,
      req.timezone
    );
    res.json({
      status: "success",
      data: notices,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /notices";
    next(error);
  }
});

router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      let notices;
      if (req.currentAdmin?.buildingId) {
        notices = await noticeController.getBuildingNotices(
          {
            ...sanitisePayload(req.query),
            buildingId: req.currentAdmin.buildingId,
          },
          req.paginate
        );
      } else {
        notices = await noticeController.getPropertyNotices(
          {
            ...sanitisePayload(req.query),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
      }
      res.json({
        status: "success",
        data: notices,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /notices/admin";
      next(error);
    }
  }
);

//create new notice
router.post(
  "/create",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await noticeController.createNotice({
        ...req.body,
        postedBy: req.currentAdmin.id,
      });
      sendResponse(res, null, "Notice created successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /notices/create";
      next(error);
    }
  }
);

//get specific notice
router.get(
  "/:noticeId",
  authToken([USER_TYPES.USER, USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      const notice = await noticeController.findNotice(req.params.noticeId);
      res.json({
        status: "success",
        data: notice,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /notices/:noticeId";
      next(error);
    }
  }
);

//edit notice - admin
router.patch(
  "/:noticeId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await noticeController.updateNotice({
        ...sanitisePayload(req.body),
        id: req.params.noticeId,
      });
      sendResponse(res, null, "Notice updated successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /notices/:noticeId";
      next(error);
    }
  }
);

//delete notice - admin
router.delete(
  "/:noticeId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await noticeController.deleteNotice({
        id: req.params.noticeId,
      });
      res.json({
        status: "success",
        data: "Notice deleted successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /notices/:noticeId";
      next(error);
    }
  }
);

//mark notice as read
router.post("/read", authToken(), async (req, res, next) => {
  try {
    if (!req.body.noticeId) {
      throw new AppError("", "Invalid Body", "custom", 200, [
        {
          column: "noticeId",
          message: "Notice ID is required",
        },
      ]);
    }
    const noticeId = req.body.noticeId;
    const readStatus = await noticeController.addReadNotice(
      req.currentUser.id,
      noticeId
    );
    res.json({
      status: "success",
      data: readStatus,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /notices/read";
    next(error);
  }
});

module.exports = router;
