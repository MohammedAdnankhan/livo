const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const helplineController = require("../controllers/helplineNumber");
const { sanitisePayload } = require("../../utils/utility");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { sendResponse } = require("../../utils/responseHandler");

//get all helplines
router.get("/", authToken(), async (req, res, next) => {
  try {
    const helplines = await helplineController.getHelplines(
      req.currentUser.flatId,
      req.language
    );
    res.json({
      status: "success",
      data: helplines,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /helplines";
    next(error);
  }
});

//get helplines - admin
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      let helplines;
      if (req.currentAdmin.buildingId) {
        helplines = await helplineController.getHelplinesFromBuilding(
          {
            ...sanitisePayload(req.query),
            buildingId: req.currentAdmin.buildingId,
          },
          req.paginate
        );
      } else {
        helplines = await helplineController.getHelplinesFromProperty(
          {
            ...sanitisePayload(req.query),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
      }
      res.json({
        status: "success",
        data: helplines,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /helplines/admin";
      next(error);
    }
  }
);

//add new helpline
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await helplineController.addHelpline({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      sendResponse(res, null, "Helpline created successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /helplines";
      next(error);
    }
  }
);

//update helpline number
router.patch(
  "/:helplineNumber",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await helplineController.updateHelplineNumber({
        ...req.body,
        id: req.params.helplineNumber,
        propertyId: req.currentAdmin.propertyId,
      });
      sendResponse(res, null, "Helpline updated successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "PATCH /helplines";
      next(error);
    }
  }
);

//get unique helpline number
router.get(
  "/:helplineId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const helpline = await helplineController.getHelplineWithBuilding({
        id: req.params.helplineId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: helpline,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /helplines/:helplineId";
      next(error);
    }
  }
);

router.delete(
  "/:helplineId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await helplineController.deleteHelpline({ id: req.params.helplineId }); //TODO: validate if admin has access to the helpline number
      res.json({
        status: "success",
        msg: "Helpline number deleted successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /helplines/:helplineId";
      next(error);
    }
  }
);

module.exports = router;
