const express = require("express");
const router = express.Router();
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const adminSubFlatRoutes = require("./admin.routes");

router.use(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  adminSubFlatRoutes
);

module.exports = router;
