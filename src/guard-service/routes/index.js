const router = require("express").Router();
const authController = require("../controllers/auth");
const guardController = require("../controllers/guard");
const { AppError } = require("../../utils/errorHandler");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { sanitisePayload } = require("../../utils/utility");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getGuardByGuardIdSchema,
  updateGuardByIdSchema,
  guardLoginSchema,
  getGuardsSchema,
} = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");

//signup
router.post("/sign-up", authToken(USER_TYPES.ADMIN), async (req, res, next) => {
  try {
    const { userName, password, mobileNumber, name } = req.body;

    let propertyId = req.body.propertyId;

    if (req.currentAdmin.propertyId) {
      propertyId = req.currentAdmin.propertyId;
    }

    if (!mobileNumber || !userName || !password || !name || !propertyId) {
      throw new AppError("", "All fields are compulsory", "custom", 422);
    }
    const newGuard = await authController.createGuard({
      ...req.body,
      propertyId,
    });
    return res.status(200).json({
      status: "success",
      msg: "Guard created successfully",
      data: newGuard,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /guards/sign-up";
    next(error);
  }
});

//login
router.post(
  "/login",
  validatePayload({ body: guardLoginSchema }),
  async (req, res, next) => {
    try {
      const result = await authController.loginGuard(req.validatedBody);

      if (req.validatedBody.refreshRequired) {
        sendResponse(res, result, "Guard logged in");
      } else {
        return res.status(200).json({
          status: "success",
          data: {
            msg: "Guard logged in",
            token: result,
          },
        });
      }
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /guards/login";
      next(error);
    }
  }
);

//get guard details
router.get("/details", authToken(USER_TYPES.GUARD), async (req, res, next) => {
  try {
    const guardBuildings = await guardController.getGuardBuildings({
      guardId: req.currentGuard.id,
      propertyId: req.currentGuard.propertyId,
    });
    res.json({
      status: "success",
      data: {
        ...req.currentGuard.get({ plain: true }),
        buildings: guardBuildings,
      },
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /guards/details";
    next(error);
  }
});

router.get(
  "/buildings",
  authToken(USER_TYPES.GUARD),
  async (req, res, next) => {
    try {
      const buildings = await guardController.getGuardBuildings({
        guardId: req.currentGuard.id,
        propertyId: req.currentGuard.propertyId,
      });
      res.json({
        status: "success",
        data: buildings,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /guards/buildings";
      next(error);
    }
  }
);

router.get("/flats", authToken(USER_TYPES.GUARD), async (req, res, next) => {
  try {
    const flats = await guardController.getGuardFlats({
      ...sanitisePayload(req.query),
      guardId: req.currentGuard.id,
      propertyId: req.currentGuard.propertyId,
    });
    res.json({
      status: "success",
      data: flats,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /guards/flats";
    next(error);
  }
});

//get guard companies
router.get(
  "/admin/companies",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const companies = await guardController.getCompaniesDropdown(
        req.currentAdmin.propertyId
      );
      sendResponse(res, companies, "Companies retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /guards/admin/companies";
      next(error);
    }
  }
);

//get guards - admin
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      let guards;
      if (req.currentAdmin.buildingId) {
        guards = await guardController.getGuardsOfBuilding(
          {
            ...sanitisePayload(req.query),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
      } else {
        guards = await guardController.getGuardsOfProperty(
          {
            ...sanitisePayload(req.query),
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
      }
      res.json({
        status: "success",
        data: guards,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /guards/admin";
      next(error);
    }
  }
);

//get guards export - admin
router.get(
  "/admin/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ query: getGuardsSchema }),
  async (req, res, next) => {
    try {
      const guards = await guardController.getGuardExports({
        ...sanitisePayload(req.validatedQuery),
        propertyId: req.currentAdmin.propertyId,
      });

      sendResponse(res, guards, "guards exported successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /guards/admin/export";
      next(error);
    }
  }
);

router.get(
  "/admin/:guardId",
  authToken(USER_TYPES.ADMIN),
  async (req, res, next) => {
    try {
      const guard = await guardController.getGuardDetails({
        id: req.params.guardId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: guard,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /guards/admin/:guardId";
      next(error);
    }
  }
);

router.patch(
  "/admin/status/:guardId",
  authToken([USER_TYPES.ADMIN]),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  validatePayload({ params: getGuardByGuardIdSchema }),
  async (req, res, next) => {
    try {
      const payload = {
        id: req.validatedParams.guardId,
        propertyId: req.currentAdmin.propertyId,
      };
      const { isActive } = await guardController.updateGuardStatus(payload);
      const msg = `Guard marked as ${isActive ? "Active" : "In-Active"}`;

      sendResponse(res, null, msg);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /guards/admin/status/:guardId";
      next(error);
    }
  }
);

//update guard
router.patch(
  "/admin/:guardId",
  authToken(USER_TYPES.ADMIN),
  validatePayload({
    params: getGuardByGuardIdSchema,
    body: updateGuardByIdSchema,
  }),
  async (req, res, next) => {
    try {
      await guardController.updateGuard(
        { id: req.params.guardId, propertyId: req.currentAdmin.propertyId },
        { ...req.body }
      );
      sendResponse(res, null, "Guard updated successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /guards/admin/:guardId";
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await authController.deleteGuard({
        id: req.params.id,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: "Guard deleted successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /guards/sign-up";
      next(error);
    }
  }
);

//change password
router.patch(
  "/change-password",
  authToken(USER_TYPES.GUARD),
  async (req, res, next) => {
    try {
      await authController.changeGuardPassword({
        ...req.body,
        id: req.currentGuard.id,
      });
      res.json({
        status: "success",
        data: "Password changed successfully",
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /guards/change-password";
      next(error);
    }
  }
);

module.exports = router;
