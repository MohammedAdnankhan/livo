const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const assetController = require("../controllers/asset");

//get assets
router.get(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      let assets;
      if (req.currentAdmin?.buildingId) {
        assets = await assetController.getAssetsOfBuilding(
          {
            ...sanitisePayload(req.query),
            buildingId: req.currentAdmin.buildingId,
          },
          req.paginate
        );
      } else {
        assets = await assetController.getAssetsOfProperty(
          {
            ...sanitisePayload(req.query),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
      }
      res.json({
        status: "success",
        data: assets,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /assets";
      next(error);
    }
  }
);

//get assets
router.get(
  "/all",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const assets = await assetController.getAssetListOfProperty({
        ...sanitisePayload(req.query),
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: assets,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /assets/all";
      next(error);
    }
  }
);

//create asset
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const asset = await assetController.createAsset({
        ...req.body,
        createdBy: req.currentAdmin.id,
      });
      res.json({
        status: "success",
        data: asset,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /assets";
      next(error);
    }
  }
);

//get asset
router.get(
  "/:assetId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const asset = await assetController.getAssetDetails({
        id: req.params.assetId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: asset,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /assets/:assetId";
      next(error);
    }
  }
);

//update asset
router.patch(
  "/:assetId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const asset = await assetController.updateAsset({
        ...req.body,
        id: req.params.assetId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: asset,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /assets/:assetId";
      next(error);
    }
  }
);

//delete asset
router.delete(
  "/:assetId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const asset = await assetController.deleteAsset({
        id: req.params.assetId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: asset,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /assets/:assetId";
      next(error);
    }
  }
);

module.exports = router;
