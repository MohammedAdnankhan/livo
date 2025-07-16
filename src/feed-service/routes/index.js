const express = require("express");
const { APP_FEATURES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { errorHandler } = require("../../utils/errorHandler");
const { checkFeature } = require("../../utils/middlewares/checkFeature");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const feedController = require("./../controllers/feed");
const router = express.Router();

router.get(
  "/posts",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  pagination,
  async (req, res, next) => {
    try {
      const feeds = await feedController.getFeedPosts(
        {
          ...req.query,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
        },
        req.paginate,
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: feeds,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /feeds/posts";
      next(error);
    }
  }
);

router.get(
  "/market-places",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  pagination,
  async (req, res, next) => {
    try {
      const feeds = await feedController.getFeedMarketPlaces(
        {
          ...req.query,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
        },
        req.paginate,
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: feeds,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /feeds/market-places";
      next(error);
    }
  }
);

router.get(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  pagination,
  async (req, res, next) => {
    try {
      const feeds = await feedController.getFeed(
        {
          ...req.query,
          userId: req.currentUser.id,
          flatId: req.currentUser.flatId,
        },
        req.paginate,
        req.timezone,
        req.language
      );
      res.json({
        status: "success",
        data: feeds,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /feeds";
      next(error);
    }
  }
);

module.exports = router;
