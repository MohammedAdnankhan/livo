const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const {
  getSideBarData,
} = require("../../property-service/controllers/property");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const adminController = require("../controllers/admin");
const authController = require("../controllers/auth");

//create new admin
router.post(
  "/",
  // authToken(USER_TYPES.ADMIN),
  // restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {

    try {
      const newAdmin = await adminController.createAdmin({
        ...req.body,
        role: ADMIN_ROLES.ADMIN,
      });
      res.json({
        status: "success",
        data: newAdmin,
      });
    } catch (error) {

      error.reference = error.reference ? error.reference : "POST /admins";
      next(error);
    }
  }
);

//update admin details
router.patch(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin([ADMIN_ROLES.ADMIN, ADMIN_ROLES.MASTER_ADMIN]),
  async (req, res, next) => {
    try {
      const updatedAdmin = await adminController.updateAdmin(
        { id: req.currentAdmin.id },
        req.body
      );
      res.json({
        status: "success",
        data: updatedAdmin,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "PATCH /admins";
      next(error);
    }
  }
);

//change password
router.patch(
  "/change-password",
  authToken(USER_TYPES.ADMIN),
  async (req, res, next) => {
    try {
      await authController.changeAdminPassword({
        ...req.body,
        id: req.currentAdmin.id,
      });
      res.json({
        status: "success",
        data: "Password changed successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /admins/change-password";
      next(error);
    }
  }
);

//login admin
router.post("/login", async (req, res, next) => {
  // conosle.log("its run now " ,"________-----------@@@@@@@@@@@@@@@@@@")

  try {
    const login = await authController.loginAdmin(req.body);
    
    res.json({
      status: "success",
      data: login,
    });
  } catch (error) {
    console.log("its in Catach")

    error.reference = error.reference ? error.reference : "POST /admins/login";
    next(error);
  }
});

router.get("/details", authToken(USER_TYPES.ADMIN), async (req, res, next) => {
  try {
    let admin = req.currentAdmin.get({ plain: true });
    let buildings = await adminController.getDetails({
      propertyId: req.currentAdmin.propertyId,
    });
    const sideBarData = await getSideBarData(req.currentAdmin.propertyId);
    res.json({
      status: "success",
      data: {
        ...admin,
        buildings,
        sideBarData,
      },
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /admins/details";
    next(error);
  }
});
module.exports = router;
