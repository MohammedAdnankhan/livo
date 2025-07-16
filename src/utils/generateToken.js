const jwt = require("jsonwebtoken");
const { TOKEN_EXPIRY_TIMES } = require("../config/constants");
const env = process.env.NODE_ENV || "development";
const jwtConfig = require("./../config/jwt.json")[env];

const REFRESH_KEY = jwtConfig.secret_key;
const ACCESS_KEY = jwtConfig.access_key;

/**
 * @function generateToken
 * @param {object} payload
 * @param {string} payload.id
 * @param {"admin" | "owner" | "user" | "guard"} payload.type
 * @param {string} secret
 * @param {string} expiry
 * @returns {Promise<string>}
 */
function generateToken(payload, secret, expiry) {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secret, { expiresIn: expiry }, (error, encoded) => {
      if (error) {
        reject(error);
      }
      resolve(encoded);
    });
  });
}

/**
 * @function generateRefreshToken
 * @param {string} id
 * @param {"admin" | "owner" | "user" | "guard"} type
 * @returns {Promise<string>}
 * @description Function to generate refresh token
 */
module.exports.generateRefreshToken = (id, type,) => {
  return generateToken(
    { id, type },
    REFRESH_KEY,
    TOKEN_EXPIRY_TIMES[env].REFRESH_TOKEN_EXPIRY_TIME
  ); //TODO: update expiry time after all apps sync up
};

/**
 * @function generateAccessToken
 * @param {string} id
 * @param {"admin" | "owner" | "user" | "guard"} type
 * @returns {Promise<string>}
 * @description Function to generate access token
 */
module.exports.generateAccessToken = (id, type) => {
  return generateToken(
    { id, type },
    ACCESS_KEY,
    TOKEN_EXPIRY_TIMES[env].ACCESS_TOKEN_EXPIRY_TIME
  ); //TODO: update expiry time after all apps sync up
};
module.exports.generate_Access_Token_Super_Admin = (payload) => {
  return generateToken(
   payload,
    ACCESS_KEY,
    TOKEN_EXPIRY_TIMES[env].ACCESS_TOKEN_EXPIRY_TIME
  ); //TODO: update expiry time after all apps sync up
};
