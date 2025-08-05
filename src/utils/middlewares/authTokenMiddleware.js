const Administrator = require("../../admin-service/models/Admin");
const { USER_TYPES } = require("../../config/constants");
const Guard = require("../../guard-service/models/Guard");
const User = require("../../user-service/models/User");
const { AppError } = require("../errorHandler");
const { updateGuardDetails } = require("../../guard-service/controllers/guard");
const {
  getMasterUserFromOwner,
} = require("../../owner-service/controllers/owner");
const { verifyAccessToken } = require("../verifyToken");
const Staff = require("../../staff-service/models/Staff");
const Tenant = require("../../super-admin-module/Tenant-services/models/tenant");

//auth token middleware
exports.authToken = (allowedTypes = [USER_TYPES.USER]) => {
  return async function (req, _res, next) {
    let token = req.headers["authorization"];
    if (typeof token !== "undefined") {
      if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
        try {
          const decodedData = verifyAccessToken(token);
          const { id, type } = decodedData;

          if (!allowedTypes.includes(type))
            return next(
              new AppError("authToken", "Token type not found", "custom", 420)
            );
          if (type == USER_TYPES.GUARD) {
            const guard = await Guard.findByPk(id);
            if (guard) {
              if (!guard.isActive) {
                return next(
                  new AppError(
                    "guardAuthToken",
                    "Account In-Active. Please contact Admin",
                    "custom",
                    420
                  )
                );
              }
              guard.password = undefined;
              req.currentGuard = guard;
              updateGuardDetails(
                { id: id },
                { lastLogin: new Date().toISOString() }
              ); //TODO: use in memory caching to avoid multiple DB calls
              next();
            } else {
              return next(
                new AppError(
                  "guardAuthToken",
                  "Guard not found.",
                  "custom",
                  420
                )
              );
            }
          } else if (type == USER_TYPES.USER) {
            const user = await User.findByPk(id);
            if (user) {
              user.password = undefined;
              req.currentUser = user;
              next();
            }
           
            
            else {
              return next(
                new AppError("userAuthToken", "User not found.", "custom", 420)
              );
            }
          }
           else if (type == USER_TYPES.ADMIN) {
            // Try to find an Administrator by id
            const admin = await Administrator.findByPk(id);
            if (admin) {
              admin.password = undefined;
              req.currentAdmin = admin;
              return next();
            }

            // If not found, try to find a Tenant by id
            const tenant = await Tenant.findByPk(id);
            if (tenant) {
              req.currentAdmin = {
                ...tenant.toJSON(),
                id: tenant.tenant_id,
                role:"Admin", // or whatever your PK is
                propertyId: tenant.propertyId || "2529b260-63b7-11f0-9549-39281bef0a52"
              };
              return next();
            }

            // If neither found, return error
            return next(
              new AppError("adminAuthToken", "Admin not found", "custom", 420)
            );
          }
           else if (type == USER_TYPES.OWNER) {
            const owner = await getMasterUserFromOwner(id);
            if (owner) {
              req.currentOwner = owner;
              req.ownerEntity = {
                id,
              };
              next();
            } else {
              return next(
                new AppError("ownerAuthToken", "Owner not found", "custom", 420)
              );
            }
          } 
          else if (type == USER_TYPES.STAFF) {
            const staff = await Staff.findByPk(id, {
              attributes: { exclude: ["password"] },
            });

            if (staff) {
              req.currentStaff = staff;
              next();
            } else {
              return next(
                new AppError("staffAuthToken", "Staff not found", "custom", 420)
              );
            }
          } else {
            return next(
              new AppError("authToken", "Token type not found", "custom", 420)
            );
          }
        } catch (error) {
          return next(
            new AppError("authToken", "Invalid token.", "custom", 401)
          );
        }
      } else {
        return next(new AppError("authToken", "Missing token.", "custom", 401));
      }
    } else {
      return next(new AppError("authToken", "Missing header.", "custom", 401));
    }
  };
};
