const router = require("express").Router();
const { APP_FEATURES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const { checkFeature } = require("../../utils/middlewares/checkFeature");
const marketPlaceController = require("../controllers/marketPlace");
const ratingController = require("../controllers/rating");

//view product conditions
router.get("/condition", async (req, res, next) => {
  try {
    const conditions = await marketPlaceController.getConditions(req.language);
    res.json({
      status: "success",
      data: conditions,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /marketplace/condition";
    next(error);
  }
});

//view product categories
router.get("/category", async (req, res, next) => {
  try {
    const categories = await marketPlaceController.getCategories(req.language);
    res.json({
      status: "success",
      data: categories,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /marketplace/category";
    next(error);
  }
});

//add new product
router.post(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const newItem = await marketPlaceController.addProduct({
        ...req.body,
        createdBy: req.currentUser.id,
        flatId: req.currentUser.flatId,
      });
      res.json({
        status: "success",
        data: newItem,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /marketplace";
      next(error);
    }
  }
);

//edit a product
router.patch(
  "/",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      if (!req.body.productId) {
        throw new AppError("", "Product ID is required");
      }
      const updatedItem = await marketPlaceController.editProduct(
        {
          createdBy: req.currentUser.id,
          id: req.body.productId,
        },
        req.body
      );
      res.json({
        status: "success",
        data: updatedItem,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /marketplace";
      next(error);
    }
  }
);

//view all marketplace items added by a user
router.get(
  "/my",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const myListings = await marketPlaceController.getMyListings(
        {
          createdBy: req.currentUser.id,
        },
        req.language
      );
      res.json({
        status: "success",
        data: myListings,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /marketplace/my";
      next(error);
    }
  }
);

//add or update ratings for an item
router.post(
  "/ratings",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const rating = await ratingController.addOrUpdateRating({
        ...req.body,
        userId: req.currentUser.id,
      });
      res.json({
        status: "success",
        msg: "Thank you for rating!",
        data: rating,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /marketplace/ratings";
      next(error);
    }
  }
);

//view a specific product
router.get(
  "/:productId",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const product = await marketPlaceController.getProduct(
        {
          id: req.params.productId,
        },
        { userId: req.currentUser.id },
        req.language
      );
      res.json({
        status: "success",
        data: product,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /marketplace/productId";
      next(error);
    }
  }
);

//delete a product
router.delete(
  "/:productId",
  authToken(),
  checkFeature(APP_FEATURES.COMMUNITY),
  async (req, res, next) => {
    try {
      const result = await marketPlaceController.deleteProduct({
        createdBy: req.currentUser.id,
        id: req.params.productId,
      });
      res.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /marketplace/productId";
      next(error);
    }
  }
);

module.exports = router;
