const express = require("express");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const buildingController = require("./../controllers/building");
const adminBuildingController = require("./../controllers/buildingAdmin");
const buildingOwnerRouter = require("./owner.routes");
const { sendResponse } = require("../../utils/responseHandler");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { getBuildingsSchema } = require("../validators");
const router = express.Router();

router.use("/owner", buildingOwnerRouter);

router.get(
  "/admin/statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const stats = await buildingController.getBuildingStatistics({
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: stats,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /buildings/admin/statistics";
      next(error);
    }
  }
);

router.get("/", async (req, res, next) => {
  try {
    const buildings = await buildingController.getBuildings(
      req.query,
      req.language
    );
    res.json({
      status: "success",
      data: buildings,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /buildings";
    next(error);
  }
});

router.get(
  "/admin/all",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const buildings = await adminBuildingController.getAllBuildings({
        ...sanitisePayload(req.query),
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: buildings,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /buildings/admin/all";
      next(error);
    }
  }
);

router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const building = await adminBuildingController.addBuilding({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: "Property created successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /buildings";
      next(error);
    }
  }
);

//edit building
router.patch(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await adminBuildingController.editBuilding({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: "Property updated successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "PATCH /buildings";
      next(error);
    }
  }
);

//get buildings - to be viewed by admin
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  validatePayload({ query: getBuildingsSchema }),
  async (req, res, next) => {
    try {
      let buildings = null;
      const params = req.validatedQuery;
      params.propertyId = req.currentAdmin.propertyId;
      if (params.list && params.list === "new") {
        delete params["list"];
        buildings = await adminBuildingController.getBuildingsListing(
          params,
          req.language,
          req.paginate
        );
      } else {
        buildings =
          await adminBuildingController.getBuildingsWithCityAndLocality(
            params,
            req.language,
            req.paginate
          );
      }
      sendResponse(res, buildings);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /buildings/admin";
      next(error);
    }
  }
);

router.get(
  "/admin/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const buildingExports = await buildingController.exportBuildings({
        ...req.query,
        propertyId: req.currentAdmin.propertyId,
      });
      sendResponse(res, buildingExports, "Properties retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /buildings/export";
      next(error);
    }
  }
);

router.get(
  "/admin/:buildingId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const building = await adminBuildingController.getBuildingForAdmin({
        id: req.params.buildingId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: building,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /buildings/admin/:buildingId";
      next(error);
    }
  }
);

router.delete(
  "/admin/:buildingId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await adminBuildingController.deleteBuilding({
        id: req.params.buildingId,
        propertyId: req.currentAdmin.propertyId,
      });

      sendResponse(res, null, "Property deleted successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /buildings/admin/:buildingId";
      next(error);
    }
  }
);

module.exports = router;
