const { getBuilding } = require("../../building-service/controllers/building");
const { getFlat } = require("../../flat-service/controllers/flat");
const {
  getPropertyFeature,
} = require("../../property-service/controllers/property");
const { AppError } = require("../errorHandler");
const logger = require("../logger");

exports.checkFeature = (feature) => {
  return async function (req, res, next) {
    try {
      let propertyId;
      if (req?.currentUser?.flatId) {
        const flat = await getFlat({ id: req.currentUser.flatId });
        const building = await getBuilding({ id: flat.buildingId });
        propertyId = building.propertyId;
      } else if (req?.currentAdmin?.propertyId) {
        propertyId = req.currentAdmin.propertyId;

      } else if (req?.currentGuard?.propertyId) {
        propertyId = req.currentGuard.propertyId;
      } else {
        return next(
          new AppError(
            "checkFeature",
            "Could not find property Id",
            "custom",
            412
          )
        );
      }

      const propertyFeature = await getPropertyFeature({
        propertyId,
      },
    );

    console.log(propertyFeature,'IsFeaturefound')
      if (propertyFeature && propertyFeature[feature]) {
        return next();
      } else {
        return next(
          new AppError(
            "checkFeature",
            `Feature not enabled. Please contact admin to enable`,
            "custom",
            200 // 200 required in mobile app
          )
        );
      }
    } catch (error) {
      console.log(error,"out--->");
      logger.info(`Error in checkFeature: ${JSON.stringify(error)}`);
      return next(
        new AppError(
          "checkFeature",
          `Error in checkFeature middleware`,
          "custom",
          500
        )
      );
    }
  };
};
