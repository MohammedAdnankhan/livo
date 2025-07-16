const express = require("express");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const router = express.Router();
const ppmController = require("../controllers/preventativeMaintenance");

//create ppm
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const ppm = await ppmController.createPreventativeMaintenance({
        ...req.body,
        adminId: req.currentAdmin.id,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: ppm,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /ppm/";
      next(error);
    }
  }
);

//get ppm categories
router.get(
  "/categories",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const categories = await ppmController.getPpmCategories({
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: categories,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /ppm/categories";
      next(error);
    }
  }
);

//get ppms
router.get(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const ppms = await ppmController.getPreventativeMaintenances(
        {
          ...sanitisePayload(req.query),
          propertyId: req.currentAdmin.propertyId,
        },
        req.paginate
      );
      res.json({
        status: "success",
        data: ppms,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /ppm";
      next(error);
    }
  }
);

//get ppm
router.get(
  "/:ppmId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const ppm = await ppmController.getPreventativeMaintenaceDetail({
        id: req.params.ppmId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: ppm,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /ppm/:ppmId";
      next(error);
    }
  }
);

router.patch(
  "/:ppmId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const ppm = await ppmController.updatePreventativeMaintenance(
        {
          id: req.params.ppmId,
          propertyId: req.currentAdmin.propertyId,
        },
        req.body
      );
      res.json({
        status: "success",
        data: ppm,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "PATCH /ppm/:ppmId";
      next(error);
    }
  }
);

module.exports = router;
