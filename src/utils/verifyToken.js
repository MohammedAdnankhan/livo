const jwt = require("jsonwebtoken");
const logger = require("./logger");
const { AppError } = require("./errorHandler");
const env = process.env.NODE_ENV || "development";
const { secret_key: refreshKey, access_key: accessKey } =
  require("./../config/jwt.json")[env];

/**
 * @function verifyToken
 * @param {string} token
 * @param {string} secret
 * @param {string | undefined} reference
 * @returns {import("./types").IJwtPayload}
 */
function verifyToken(token, secret, reference = "verifyToken") {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.error(`Error while verifying token: ${error.message}`);
      throw new AppError(reference, "Invalid Token!!", error.name, 401);
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(reference, "Token expired", error.name, 401);
    }
    throw error;
  }
}

/**
 * @function verifyRefreshToken
 * @param {string} token
 * @returns {import("./types").IJwtPayload}
 * @description Function to verify refresh token
 */
module.exports.verifyRefreshToken = (token) => {
  const reference = "verifyRefreshToken";
  return verifyToken(token, refreshKey, reference);
};

/**
 * @function verifyAccessToken
 * @param {string} token
 * @returns {import("./types").IJwtPayload}
 * @description Function to verify access token
 */
module.exports.verifyAccessToken = (token) => {
  const reference = "verifyAccessToken";
  return verifyToken(token, accessKey, reference);
};
