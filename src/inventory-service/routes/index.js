const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const inventoryController = require("../controllers/inventory");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  addInventorySchema,
  getInventoriesSchema,
  getInventoriesDropdownSchema,
} = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");

router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ body: addInventorySchema }),
  async (req, res, next) => {
    try {
      const data = await inventoryController.addInventory({
        ...req.validatedBody,
        propertyId: req.currentAdmin.propertyId,
      });

      sendResponse(res, data, "Product added successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /inventories";
      next(error);
    }
  }
);

router.patch(
  "/:inventoryId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      updatedInventory = await inventoryController.updateInventory({
        ...req.body,
        id: req.params.inventoryId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: updatedInventory,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /inventories";
      next(error);
    }
  }
);

router.get(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  validatePayload({ query: getInventoriesSchema }),
  async (req, res, next) => {
    try {
      let inventories;
      if (req.validatedQuery.buildingId) {
        inventories = await inventoryController.getInventoryByBuildingId(
          { ...req.validatedQuery },
          req.paginate
        );
      } else {
        inventories = await inventoryController.getInventoryByPropertyId(
          { ...req.validatedQuery, propertyId: req.currentAdmin.propertyId },
          req.paginate
        );
      }
      sendResponse(res, inventories);
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /inventories";
      next(error);
    }
  }
);

router.get(
  "/:inventoryId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const inventory = await inventoryController.getInventoryWithBuilding({
        id: req.params.inventoryId,
      });
      res.json({
        status: "success",
        msg: "Inventory retrieved",
        data: inventory,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /inventories/:inventoryId";
      next(error);
    }
  }
);

router.delete(
  "/:inventoryId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await inventoryController.deleteInventory({ id: req.params.inventoryId });
      res.json({
        status: "success",
        msg: "Inventory deleted successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /inventories/:inventoryId";
      next(error);
    }
  }
);

router.get(
  "/list/all",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getInventoriesDropdownSchema }),
  async (req, res, next) => {
    try {
      const inventories = await inventoryController.getInventoryDropdown({
        ...req.validatedQuery,
        propertyId: req.currentAdmin.propertyId,
      });
      sendResponse(res, inventories, `inventories retrieved successfully`);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /inventories/list/all";
      next(error);
    }
  }
);

module.exports = router;
