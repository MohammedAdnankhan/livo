const express = require("express");
const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { sanitisePayload } = require("../../utils/utility");
const floorController = require("../controllers/floorController");
const {
  validateBuildingForGuard,
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const router = express.Router();

router.get(
  "/:buildingId",
  authToken(USER_TYPES.GUARD),
  validateBuildingForGuard,
  async (req, res, next) => {
    try {
      const floors = await floorController.getFloors(
        { buildingId: req.params.buildingId },
        req.language
      );
      res.json({
        status: "success",
        data: floors,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /floors";
      next(error);
    }
  }
);

router.get(
  "/flats/:buildingId",
  authToken([USER_TYPES.GUARD]),
  validateBuildingForGuard,
  async (req, res, next) => {
    try {
      const response = await floorController.getFloorsWithFlats(
        {
          ...sanitisePayload(req.query),
          buildingId: req.params.buildingId,
        },
        req.language
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /floors/flats";
      next(error);
    }
  }
);

//get flats with status
router.get(
  "/flats/status/:buildingId",
  authToken([USER_TYPES.GUARD]),
  validateBuildingForGuard,
  async (req, res, next) => {
    try {
      const response = await floorController.getFlatsWithStatus(
        {
          ...req.query,
          buildingId: req.params.buildingId,
        },
        req.language
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /floors/flats/status/:buildingId";
      next(error);
    }
  }
);

//get vacant flats
router.get(
  "/flats/vacant/:buildingId",
  authToken([USER_TYPES.GUARD, USER_TYPES.ADMIN]),
  validateBuildingForGuard,
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      const response = await floorController.getVacantFlats(
        {
          ...sanitisePayload(req.query),
          buildingId: req.params.buildingId,
        },
        req.language
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /floors/flats/status";
      next(error);
    }
  }
);

module.exports = router;
