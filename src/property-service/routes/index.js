const express = require("express");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const propertyController = require("./../controllers/property");
const router = express.Router();

router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const response = await propertyController.getProperties(
        {
          ...sanitisePayload(req.query),
        },
        req.paginate
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /properties/admin";
      next(error);
    }
  }
);

//get property
router.get(
  "/admin/:propertyId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const property = (
        await propertyController.getProperties(
          { id: req.params.propertyId },
          { limit: 1, offset: 0 }
        )
      )?.rows?.[0];
      res.json({
        status: "success",
        data: property,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /properties/admin/:propertyId";
      next(error);
    }
  }
);

//get property features
router.get(
  "/features",
  authToken([USER_TYPES.USER, USER_TYPES.ADMIN, USER_TYPES.GUARD]),
  async (req, res, next) => {
    try {
      let response;
      if (req?.currentAdmin?.propertyId) {
        response = await propertyController.getPropertyFeature({
          propertyId: req.currentAdmin.propertyId,
        });
      } else if (req?.currentGuard?.propertyId) {
        response = await propertyController.getPropertyFeature({
          propertyId: req.currentGuard.propertyId,
        });
      } else if (req?.currentUser?.flatId) {
        response = await propertyController.getPropertyFeatureFromFlat(
          req.currentUser.flatId
        );
      } else {
        throw new AppError(
          "",
          "Flat Id or Property Id is missing",
          "custom",
          412
        );
      }
      if (!response) {
        throw new AppError("", "Property features not found", "custom", 404);
      }
      return res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /properties/features";
      next(error);
    }
  }
);

//create property
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const property = await propertyController.createProperty(req.body);
      res.json({
        status: "success",
        data: property,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /properties";
      next(error);
    }
  }
);

//edit property
router.patch(
  "/:propertyId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const property = await propertyController.updateProperty({
        ...req.body,
        id: req.params.propertyId,
      });
      res.json({
        status: "success",
        data: property,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /properties/:propertyId";
      next(error);
    }
  }
);

//update property features
router.patch(
  "/features/:propertyId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const propertyFeature = await propertyController.updatePropertyFeatures({
        ...req.body,
        propertyId: req.params.propertyId,
      });
      return res.json({
        status: "success",
        data: propertyFeature,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /properties/features";
      next(error);
    }
  }
);

router.get("/mine", authToken([USER_TYPES.GUARD]), async (req, res, next) => {
  try {
    const response = await propertyController.getProperty(
      {
        id: req.currentGuard.propertyId,
      },
      req.language
    );
    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /properties/mine";
    next(error);
  }
});

module.exports = router;
