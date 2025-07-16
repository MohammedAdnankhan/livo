const { AppError } = require("../errorHandler");

function checkBuildingId(req, res, next) {
  if (!req.currentAdmin.buildingId) {
    return next(
      new AppError("checkBuildingId", "Building Id is required", "custom", 412)
    );
  }
  next();
}

module.exports = { checkBuildingId };
