const { Router } = require("express");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { USER_TYPES } = require("../../config/constants");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getOwnerBuildingsSchema,
  getBuildingFromBuildingIdSchema,
} = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");
const buildingOwnerController = require("../controllers/buildingOwner");
const validateOwnerBuildingAccess = require("../../utils/middlewares/validateOwnerBuildingAccess");

const buildingOwnerRouter = Router();

buildingOwnerRouter
  .route("/")
  .get(
    authToken([USER_TYPES.OWNER]),
    pagination,
    validatePayload({ query: getOwnerBuildingsSchema }),
    async (req, res, next) => {
      try {
        const payload = { ...req.validatedQuery, ownerId: req.currentOwner.id };
        const buildings = await buildingOwnerController.getOwnerBuildings(
          payload,
          req.paginate,
          req.language
        );
        sendResponse(res, buildings, "Buildings fetched successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /buildings/owner";
        next(error);
      }
    }
  );

buildingOwnerRouter
  .route("/:buildingId")
  .get(
    authToken([USER_TYPES.OWNER]),
    validateOwnerBuildingAccess("params"),
    validatePayload({ params: getBuildingFromBuildingIdSchema }),
    async (req, res, next) => {
      try {
        const buildingId = req["validatedParams"]["buildingId"];
        const findBuilding = req.currentOwner.buildings.find(
          ({ id }) => id === buildingId
        );
        const payload = {
          buildingId,
          flatIds: findBuilding.flats.map(({ id }) => id),
          ownerId: req.currentOwner.id,
        };
        const building = await buildingOwnerController.getBuildingForOwner(
          payload,
          req.language
        );
        sendResponse(res, building, "Building retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /buildings/owner/:buildingId";
        next(error);
      }
    }
  );

module.exports = buildingOwnerRouter;
