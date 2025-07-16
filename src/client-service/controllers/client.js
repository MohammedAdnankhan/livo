const PropertyFeature = require("../../property-service/models/PropertyFeature");
const { AppError } = require("../../utils/errorHandler");
const ClientMapping = require("../models/ClientMapping");
const db = require("../../database");
const {
  clientIdentificationValues,
  USER_TYPES,
} = require("../../config/constants");
const User = require("../../user-service/models/User");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const {
  generateRefreshToken,
  generateAccessToken,
} = require("../../utils/generateToken");
const { createTokenEntity } = require("../../token-service/controllers/token");

module.exports.registerNewClient = async (data) => {
  const reference = `registerNewClient`;
  let responseData;
  try {
    const dbParams = {
      where: {
        propertyId: data.clientId,
        isApiAccessible: true,
        clientSecret: data.clientSecret,
      },
    };

    const property = await PropertyFeature.findOne(dbParams);

    if (!property) {
      throw new AppError(reference, "Invalid credentials", "custom", 412);
    }

    const checkUserMappingParams = {
      where: {
        propertyId: data.clientId,
        userIdType: data.userIdType,
        userIdValue: data.userIdValue,
        flatId: data.flatId,
      },
    };
    const userMapping = await ClientMapping.findOne(checkUserMappingParams);

    if (userMapping) {
      const dbParams = {};
      if (data.userIdType === clientIdentificationValues.UUID) {
        dbParams["where"] = {
          name: data.userIdValue,
        };
      } else {
        dbParams["where"] = {
          [data.userIdType]: data.userIdValue,
        };
      }
      const getUserData = await User.findOne(dbParams);
      const [refreshToken, accessToken] = await Promise.all([
        generateRefreshToken(getUserData.id, USER_TYPES.USER),
        generateAccessToken(getUserData.id, USER_TYPES.USER),
      ]);

      await createTokenEntity({ token: refreshToken, userId: getUserData.id });
      responseData = { accessToken, refreshToken, userType: USER_TYPES.USER };
    } else {
      const createClientUserMappingParams = {
        propertyId: data.clientId,
        userIdType: data.userIdType,
        userIdValue: data.userIdValue,
        flatId: data.flatId,
      };
      const userParams = {};
      if (data.userIdType === clientIdentificationValues.UUID) {
        userParams["name"] = data.userIdValue;
      } else {
        userParams[`${data.userIdType}`] = data.userIdValue;
      }

      if (
        await User.findOne({
          where: {
            ["name" in userParams ? "name" : [`${data.userIdType}`]]:
              data.userIdValue,
          },
        })
      ) {
        throw new AppError(
          reference,
          "User with provided details already exist",
          "custom",
          412
        );
      }

      userParams["flatId"] = data.flatId;

      const transaction = await db.sequelize.transaction();
      try {
        await ClientMapping.create(createClientUserMappingParams, {
          transaction,
        });
        const user = await User.create(userParams, { transaction });

        await MasterUser.create(
          { ...userParams, propertyId: data.clientId },
          { transaction }
        );
        await transaction.commit();
        const [refreshToken, accessToken] = await Promise.all([
          generateRefreshToken(user.id, USER_TYPES.USER),
          generateAccessToken(user.id, USER_TYPES.USER),
        ]);

        await createTokenEntity({
          token: refreshToken,
          userId: user.id,
        });
        responseData = { accessToken, refreshToken, userType: USER_TYPES.USER };
      } catch (error) {
        await transaction.rollback();
        throw new AppError(reference, "Something went wrong", "custom", 500);
      }
    }
    return responseData;
  } catch (error) {
    throw error;
  }
};
