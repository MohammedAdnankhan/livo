const { AppError } = require("../errorHandler");

const validateOwnerFlatAccess = (
  isValidationRequired = true,
  path = "query"
) => {
  const reference = "validateOwnerFlatAccess";
  return function (req, res, next) {
    try {
      if (!isValidationRequired) {
        return next();
      }
      if (!req.currentOwner) {
        throw new AppError(reference, "Invalid Auth", "custom", 403);
      }

      const pathObj = req[path];

      if (!pathObj) {
        throw new AppError(
          reference,
          "Invalid path for owner's flat validation",
          "custom",
          500
        );
      }

      const flatId = pathObj["flatId"];

      if (!flatId) {
        throw new AppError(reference, "No flat selected", "custom", 403);
      }

      const ownedFlats = req.currentOwner.buildings.flatMap(({ flats }) =>
        flats.map(({ id }) => id)
      );
      if (!ownedFlats.includes(flatId)) {
        throw new AppError(
          reference,
          "You do not own the flat. Please contact Admin",
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

module.exports = validateOwnerFlatAccess;
