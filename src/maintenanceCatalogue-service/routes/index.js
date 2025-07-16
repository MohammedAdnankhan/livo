const router = require("express").Router();
const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const maintenanceChargeCatalogueController = require("../controllers/maintenanceChargeCatalogue");
const maintenanceCatalogueController = require("../controllers/maintenanceCatalogue");

//get charge catalogues
router.get(
  "/charges/types",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const catalogues =
        await maintenanceChargeCatalogueController.getChargeCatalogueTypes();
      res.json({
        status: "success",
        data: catalogues,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenance-catalogues/charges/types";
      next(error);
    }
  }
);

//create charge catalogue
router.post(
  "/charges",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const chargeCatalogue =
        await maintenanceChargeCatalogueController.createChargeCatalogue(
          req.body
        );
      res.json({
        status: "success",
        data: chargeCatalogue,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenance-catalogues/charges";
      next(error);
    }
  }
);

//get charges of a category
router.get(
  "/charges/category",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const catalogueByCategory =
        await maintenanceChargeCatalogueController.getChargeCatalogueByCategory(
          req.query
        );
      res.json({
        status: "success",
        data: catalogueByCategory,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenance-catalogues/charges/category";
      next(error);
    }
  }
);

//get all charges catalogue
router.get(
  "/charges",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const chargesCatalogue =
        await maintenanceChargeCatalogueController.getChargesCatalogue();
      res.json({
        status: "success",
        data: chargesCatalogue,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenance-catalogues/charges";
      next(error);
    }
  }
);

//edit charge catalogue
router.patch(
  "/charges",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const chargeCatalogue =
        await maintenanceChargeCatalogueController.editChargeCatalogue(
          req.body
        );
      res.json({
        status: "success",
        data: chargeCatalogue,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /maintenance-catalogues/charges";
      next(error);
    }
  }
);

//request payment
router.post(
  "/request-payment",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const paymentRequest =
        await maintenanceCatalogueController.requestPayment(req.body);
      res.json({
        status: "success",
        data: paymentRequest,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /maintenance-catalogues/request-payment";
      next(error);
    }
  }
);

//get requested payment
router.get(
  "/request-payment/:requestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const paymentRequest =
        await maintenanceCatalogueController.getRequestedPayment({
          id: req.params.requestId,
        });
      res.json({
        status: "success",
        data: paymentRequest,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /maintenance-catalogues/request-payment/:requestId";
      next(error);
    }
  }
);

module.exports = router;
