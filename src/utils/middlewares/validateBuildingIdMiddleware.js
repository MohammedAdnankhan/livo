const {
  getBuildingWithProperty,
} = require("../../building-service/controllers/building");
const { ADMIN_ROLES } = require("../../config/constants");
const { getGuardBuilding } = require("../../guard-service/controllers/guard");
const { AppError } = require("../errorHandler");
const { isValidUUID } = require("../utility");

async function validateBuildingIdForAdmin(req, res, next) {
  const reference = "validateBuildingIdForAdmin";
  let buildingId;
  try {
    if (
      !req.currentAdmin ||
      req.currentAdmin?.role === ADMIN_ROLES.MASTER_ADMIN
    ) {
      return next();
    }

    if (req.query?.buildingId) {
      buildingId = req.query.buildingId;
    } else if (req.params?.buildingId) {
      buildingId = req.params.buildingId;
    } else if (req.body?.buildingId) {
      buildingId = req.body.buildingId;
    }

    if (buildingId) {
      if (!isValidUUID(buildingId)) {
        throw new AppError(reference, "Enter valid buildingId", "custom", 412);
      }
      const building = await getBuildingWithProperty(
        { id: buildingId },
        { id: req.currentAdmin.propertyId }
      );
      if (!building) {
        throw new AppError(
          reference,
          "Cannot access this building",
          "custom",
          403
        );
      }
      req.currentAdmin.buildingId = buildingId;
    }
    return next();
  } catch (error) {
    return next(error);
  }
  // if (req.currentAdmin.role === ADMIN_ROLES.MASTER_ADMIN) {
  //   return next();
  // }
  // if (req.query.buildingId) {
  //   try {
  //     const building = await getBuildingWithProperty(
  //       {
  //         id: req.query.buildingId,
  //       },
  //       { id: req.currentAdmin.propertyId }
  //     );
  //     if (!building) {
  //       return next(
  //         new AppError(
  //           "validateBuildingIdForAdmin",
  //           "Cannot access this building",
  //           "custom",
  //           403
  //         )
  //       );
  //     }
  //     req.currentAdmin.buildingId = req.query.buildingId;
  //   } catch (error) {
  //     return next(
  //       new AppError(
  //         "validateBuildingIdForAdmin",
  //         "Enter valid building Id",
  //         "custom",
  //         400
  //       )
  //     );
  //   }
  // }
  // next();
}

async function validateBuildingForGuard(req, res, next) {
  const reference = "validateBuildingForGuard";
  let buildingId;
  try {
    if (!req.currentGuard) {
      return next();
    }
    if (req.params?.buildingId) {
      buildingId = req.params.buildingId;
    } else if (req.query?.buildingId) {
      buildingId = req.query.buildingId;
    } else if (req.body?.buildingId) {
      buildingId = req.body.buildingId;
    } else {
      throw new AppError(reference, "Building Id is required", "custom", 412);
    }

    if (!isValidUUID(buildingId)) {
      throw new AppError(reference, "Enter valid buildingId", "custom", 412);
    }

    const guardBuilding = await getGuardBuilding({
      guardId: req.currentGuard.id,
      buildingId,
    });
    if (!guardBuilding) {
      throw new AppError(
        reference,
        "Cannot access this building, Contact Admin",
        "custom",
        403
      );
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  validateBuildingIdForAdmin,
  validateBuildingForGuard,
};
