const express = require("express");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { errorHandler } = require("../../utils/errorHandler");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const cityController = require("./../controllers/city");
const router = express.Router();
const { sendResponse } = require("../../utils/responseHandler");

router.get("/", async (req, res, next) => {
  try {
    const cities = await cityController.getCities(req.query, req.language);
    res.json({
      status: "success",
      data: cities,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /cities";
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
      const cities = await cityController.getCitiesForAdmin(
        { ...sanitisePayload(req.query) },
        req.paginate,
        req.language
      );
      res.json({
        status: "success",
        data: cities,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /cities/admin";
      next(error);
    }
  }
);

router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const city = await cityController.addCity(req.body);
      res.json({
        status: "success",
        data: city,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /cities";
      next(error);
    }
  }
);

router.get("/countries", (req, res, next) => {
  try {
    res.json({
      status: "success",
      data: cityController.getCountries(),
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /cities/countries";
    next(error);
  }
});

router.get("/admin/countries", async (req, res, next) => {
  try {
    const countries = await cityController.getInternalCountriesList();
    res.json({
      status: "success",
      data: countries,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /cities/admin/countries";
    next(error);
  }
});

router.get("/admin/list", async (req, res, next) => {
  try {
    const countries = await cityController.getInternalCitiesList(
      req.query?.country
    );
    res.json({
      status: "success",
      data: countries,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /cities/admin/list";
    next(error);
  }
});
//sobha country and city routes 
router.get("/sobha-countries", async (req, res, next) => {  
  try {
    const countries = cityController.getCountriesList();
    sendResponse(res, countries, "countries retrieved successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /cities/sobha-countries";
    next(error);
  }
});
router.get("/sobha-cities", async (req, res, next) => {
  try {
    const cities = await cityController.getCitiesByCountry(req.query?.countryId);
    sendResponse(res, cities, "cities retrieved successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /cities/sobha-cities";
    next(error);
  }
});
module.exports = router;
