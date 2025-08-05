const express = require("express");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const localityController = require("./../controllers/locality");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { createLocalitySchema } = require("../validators");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const localities = await localityController.getLocalities(
      { ...sanitisePayload(req.query) },
      req.language
    );
    res.json({
      status: "success",
      data: localities,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /localities";
    next(error);
  }
});

router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const localities = await localityController.getLocalitiesForAdmin(
        { ...sanitisePayload(req.query) },
        req.paginate,
        req.language
      );
      res.json({
        status: "success",
        data: localities,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /localities/admin";
      next(error);
    }
  }
);
router.post(
  "/",
  // authToken(USER_TYPES.ADMIN),
  // restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ body: createLocalitySchema }),
  async (req, res, next) => {
    try {
      console.log(req.body,"lksjdflkjsd")
      const locality = await localityController.addLocality(req.validatedBody);
      // const locality = await localityController.addLocality(req.body);
      res.json({
        status: "success",
        msg: "Locality created successfully",
        data: locality,
      });
    } catch (error) {
      console.log(error,"lets check",error.reference);
      error.reference = error.reference ? error.reference : "POST /localities";
      next(error);
    }
  }
);

router.get("/cities", (req, res, next) => {
  try {
    res.json({
      status: "success",
      data: localityController.getCities(req.query?.countryCode),
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /localities/cities";
    next(error);
  }
});

module.exports = router;
