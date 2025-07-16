const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const masterUserController = require("../controllers/masterUser");
const { sanitisePayload } = require("../../utils/utility");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { sendResponse } = require("../../utils/responseHandler");
const muOwnerRoutes = require("./owner.routes");
const muAdminRoutes = require("./admin.routes");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { getMasterUsersSchema, approveSignUpSchema } = require("../validators");

router.use("/owner", authToken([USER_TYPES.OWNER]), muOwnerRoutes);

router.use(
  "/admin",
  authToken([USER_TYPES.ADMIN]),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  muAdminRoutes
);

router.get(
  "/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getMasterUsersSchema }),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const users = await masterUserController.getUsersInPropertyForExport({
        ...sanitisePayload(req.query),
        propertyId: req.currentAdmin.propertyId,
        buildingId: req.currentAdmin?.buildingId,
      });
      sendResponse(res, users);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /master-users/export";
      next(error);
    }
  }
);

//approve a user FIXME: update contract data
router.post(
  "/approve",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ body: approveSignUpSchema }),
  async (req, res, next) => {
    try {
      const approveUser = await masterUserController.approveUser(
        {
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        },
        req.timezone
      );
      res.json({
        status: "success",
        msg: `User onboarded successfully`,
        data: approveUser,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /master-users/approve";
      next(error);
    }
  }
);

router.delete(
  "/deny/:requestedFlat",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const deny = await masterUserController.denyUser({
        requestedFlat: req.params.requestedFlat,
      });
      res.json({
        status: "success",
        data: deny,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /master-users/deny";
      next(error);
    }
  }
);

module.exports = router;
