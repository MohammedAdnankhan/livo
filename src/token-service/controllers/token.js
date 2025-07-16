const db = require("../../database");
const Token = require("../models/Token");
const { AppError } = require("../../utils/errorHandler");
const { verifyRefreshToken } = require("../../utils/verifyToken");
const {
  generateRefreshToken,
  generateAccessToken,
} = require("../../utils/generateToken");
const { Op } = require("sequelize");
const { USER_TYPES, TOKEN_EXPIRY_TIMES } = require("../../config/constants");
const logger = require("../../utils/logger");
const env = process.env.NODE_ENV || "development";
const jwt = require("jsonwebtoken");
const {
  removeOwnerToken,
} = require("../../ownerNotification-service/controllers/pushDevice");
const {
  removeAdminToken,
} = require("../../adminNotification-service/controllers/adminPushDevice");
const {
  removeUserToken,
} = require("../../userNotification-service/controllers/pushDevice");

/**
 * @async
 * @function deleteToken
 * @param {object} params
 * @returns {Promise<null>}
 * @description Function to delete token from database
 */
module.exports.deleteToken = async (params) => {
  await Token.destroy({ where: params, force: true });
  return null;
};

/**
 * @async
 * @function generateNewTokens
 * @param {string} token
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 * @description Function to generate new refresh and access token from refresh token
 */
module.exports.generateNewTokens = async (token) => {
  const reference = "generateAccessToken";

  const query = `
    SELECT t.token,
    CASE
      WHEN u.id IS NOT NULL AND a.id IS NULL AND g.id IS NULL AND o.id IS NULL AND s.id IS NULL THEN u.id
      WHEN u.id IS NULL AND a.id IS NOT NULL AND g.id IS NULL AND o.id IS NULL AND s.id IS NULL THEN a.id
      WHEN u.id IS NULL AND a.id IS NULL AND g.id IS NULL AND o.id IS NOT NULL AND s.id IS NULL THEN o.id
      WHEN u.id IS NULL AND a.id IS NULL AND g.id IS NULL AND o.id IS NULL AND s.id IS NOT NULL THEN s.id
    END AS id,
    CASE
      WHEN u.id IS NOT NULL AND a.id IS NULL AND g.id IS NULL AND o.id IS NULL AND s.id IS NULL THEN '${USER_TYPES.USER}'
      WHEN u.id IS NULL AND a.id IS NOT NULL AND g.id IS NULL AND o.id IS NULL AND s.id IS NULL THEN '${USER_TYPES.ADMIN}'
      WHEN u.id IS NULL AND a.id IS NULL AND g.id IS NULL AND o.id IS NOT NULL AND s.id IS NULL THEN '${USER_TYPES.OWNER}'
      WHEN u.id IS NULL AND a.id IS NULL AND g.id IS NULL AND o.id IS NULL AND s.id IS NOT NULL THEN '${USER_TYPES.STAFF}'
      ELSE '${USER_TYPES.GUARD}'
    END AS "userType" FROM tokens t
    LEFT JOIN users u ON (u.id = t."userId" AND u."deletedAt" IS NULL)
    LEFT JOIN administrators a ON (a.id = t."adminId" AND a."deletedAt" IS NULL)
    LEFT JOIN guards g ON (g.id = t."guardId" AND g."deletedAt" IS NULL)
    LEFT JOIN owners o ON (o.id = t."ownerId" AND o."deletedAt" IS NULL)
    LEFT JOIN staffs s ON (s.id = t."staffId" AND s."deletedAt" IS NULL)
    WHERE t."deletedAt" IS NULL AND token = :token
    AND (u.id IS NOT NULL OR a.id IS NOT NULL OR g.id IS NOT NULL OR o.id IS NOT NULL OR s.id IS NOT NULL)`;

  const [userToken] = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    replacements: {
      token,
    },
  });

  if (!userToken) {
    const { id, type } = jwt.decode(token);
    switch (type) {
      case USER_TYPES.USER:
        await removeUserToken({ userId: id });
        break;
      case USER_TYPES.ADMIN:
        await removeAdminToken({ adminId: id });
        break;
      case USER_TYPES.OWNER:
        await removeOwnerToken({ ownerId: id });
        break;
      case USER_TYPES.STAFF:
        break;
      default:
        logger.warn("No valid user type found for this id:", id);
        break;
    }
    //TODO: remove hacked user's data
    throw new AppError(
      reference,
      "Unauthorized to perform action",
      "custom",
      420
    );
  }

  try {
    const decodedData = verifyRefreshToken(token);
    const { id, type, exp, iat } = decodedData;

    if (id !== userToken.id) {
      throw new AppError(reference, "Unauthorized", "custom", 420);
    }
    if (
      new Date() - new Date(iat * 1000) <
      TOKEN_EXPIRY_TIMES[env].TIME_EXPIRY_SECONDS * 1000
    ) {
      throw new AppError(
        reference,
        "New token generation restricted",
        "custom",
        412
      );
    }
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      await this.deleteToken({ token });
      throw new AppError(reference, "Token Expired!", "custom", 420);
    }
    //TODO: have to add token malformed  error
    throw error;
    // throw new AppError(reference, "Invalid Token!", "custom", 420);
  }
  const [refreshToken, accessToken] = await Promise.all([
    generateRefreshToken(userToken.id, userToken.userType),
    generateAccessToken(userToken.id, userToken.userType),
  ]);

  const tokenEntity = {
    token: refreshToken,
    [`${userToken.userType}Id`]: userToken.id,
  };

  const { id } = await Token.create(tokenEntity);
  this.deleteToken({
    [`${userToken.userType}Id`]: userToken.id,
    id: { [Op.ne]: id },
  }).catch((err) =>
    logger.error(`Error while deleting tokens - ${JSON.stringify(err)}`)
  );

  return { accessToken, refreshToken };
};

/**
 * @async
 * @function createTokenEntity
 * @param {object} data
 * @param {string} data.token
 * @param {string | undefined} data.userId
 * @param {string | undefined} data.guardId
 * @param {string | undefined} data.adminId
 * @param {string | undefined} data.ownerId
 * @returns {Promise<object>}
 * @description Function to create Token in DB
 */
module.exports.createTokenEntity = async (data) => {
  return await Token.create(data);
};
