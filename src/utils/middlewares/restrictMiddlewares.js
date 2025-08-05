const { ADMIN_ROLES } = require("../../config/constants");
const { AppError } = require("../errorHandler");

const restrictAdmin = (
  roles = [ADMIN_ROLES.ADMIN, ADMIN_ROLES.MASTER_ADMIN, ADMIN_ROLES.TENANT] 
) => {
  return async function (req, res, next) {
    let rolesArray = Array.isArray(roles) ? roles : [roles];
    if (rolesArray.includes(req.currentAdmin.role)) {
      next();
    } else {
      return next(
        new AppError("restrictAdmin", "Permission denied", "custom", 403)
      );
    }
  };
};

module.exports = { restrictAdmin };
