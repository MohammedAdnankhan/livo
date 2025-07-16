const router = require("express").Router();
const {
  USER_TYPES,
  ADMIN_ROLES,
  APP_FEATURES,
} = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const postController = require("../controllers/post");
const reportedPostController = require("../controllers/reportedPost");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const {
  checkBuildingId,
} = require("../../utils/middlewares/checkBuildingIdMiddleware");
const { checkFeature } = require("../../utils/middlewares/checkFeature");

//create new post
router.post(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const newPost = await postController.createPost({
        ...req.body,
        createdBy: req.currentUser.id,
        flatId: req.currentUser.flatId,
      });
      res.json({
        status: "success",
        data: newPost,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /posts";
      next(error);
    }
  }
);

//get your own posts
router.get(
  "/my",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  pagination,
  async (req, res, next) => {
    try {
      const myPosts = await postController.getOwnPosts(
        {
          createdBy: req.currentUser.id,
          flatId: req.currentUser.flatId,
        },
        req.language,
        req.paginate
      );
      res.json({
        status: "success",
        data: myPosts,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /posts/my";
      next(error);
    }
  }
);

//get report reasons
router.get(
  "/report/reasons",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const reportReasons = await reportedPostController.getReportReasons();
      res.json({
        status: "success",
        data: reportReasons,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /posts/report/reasons";
      next(error);
    }
  }
);

//report a post
router.post(
  "/report",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const report = await reportedPostController.reportPost({
        ...req.body,
        reportedBy: req.currentUser.id,
      });
      res.json({
        status: "success",
        data: report,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /posts/report";
      next(error);
    }
  }
);

//view all reported post - to be viewed by admin
router.get(
  "/reported",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  checkFeature(APP_FEATURES.COMMUNITY),
  validateBuildingIdForAdmin,
  checkBuildingId,
  async (req, res, next) => {
    try {
      const reportedPosts = await reportedPostController.getReportedPosts({
        targetId: req.currentAdmin.buildingId,
      });
      res.json({
        status: "success",
        data: reportedPosts,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /posts/reported";
      next(error);
    }
  }
);

router.delete(
  "/admin/:postId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  checkFeature(APP_FEATURES.COMMUNITY),
  validateBuildingIdForAdmin,
  checkBuildingId,
  async (req, res, next) => {
    try {
      await reportedPostController.deleteReportedPost({
        targetId: req.currentAdmin.buildingId,
        postId: req.params.postId,
      });
      res.json({
        status: "success",
        data: "Post removed successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /posts/admin/:postId";
      next(error);
    }
  }
);

//delete a post
router.delete(
  "/:postId",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      await postController.deletePost({
        id: req.params.postId,
        createdBy: req.currentUser.id,
      });
      res.json({
        status: "success",
        data: "Post deleted successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE posts/postId";
      next(error);
    }
  }
);

//view a post
router.get(
  "/:postId",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const post = await postController.getSpecificPostWithFiles(
        {
          id: req.params.postId,
        },
        { userId: req.currentUser.id }
      );
      res.json({
        status: "success",
        data: post,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET posts/postId";
      next(error);
    }
  }
);

//get files for a post
router.get(
  "/files/:postId",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  pagination,
  async (req, res, next) => {
    try {
      const postFiles = await postController.getPostFiles(
        { postId: req.params.postId },
        req.query,
        req.paginate
      );
      res.json({
        status: "success",
        data: postFiles,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET posts/files/postId";
      next(error);
    }
  }
);

module.exports = router;
