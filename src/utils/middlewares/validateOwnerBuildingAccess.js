const { AppError } = require("../errorHandler");

const validateOwnerBuildingAccess = (path = "query", isRequired = true) => {
  const reference = "validateOwnerBuildingAccess";
  return function (req, _res, next) {
    try {
      if (!req.currentOwner) {
        throw new AppError(reference, "Invalid Authentication", "custom", 403);
      }
      const pathObj = req[path];

      if (!pathObj) {
        throw new AppError(
          reference,
          "Invalid path for owner's building validation",
          "custom",
          500
        );
      }

      const buildingId = pathObj["buildingId"];
      if (isRequired && !buildingId) {
        throw new AppError(reference, "No Building selected", "custom", 403);
      }
      const buildingsAccessible = req.currentOwner.buildings.map(
        ({ id }) => id
      );

      if (isRequired && !buildingsAccessible.includes(buildingId)) {
        throw new AppError(
          reference,
          "You do not own any flat in this building. Please contact Admin",
          "custom",
          403
        );
      }
      if (
        !isRequired &&
        buildingId &&
        !buildingsAccessible.includes(buildingId)
      ) {
        throw new AppError(
          reference,
          "You do not own any flat in this Building. Please contact Admin",
          "custom",
          403
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = validateOwnerBuildingAccess;
