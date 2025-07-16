const Guard = require("../models/Guard");
const { Op } = require("sequelize");
const { AppError } = require("../../utils/errorHandler");
const { USER_TYPES } = require("../../config/constants");
const { getBuilding } = require("../../building-service/controllers/building");
const GuardBuilding = require("../models/GuardBuilding");
const { getGuard } = require("./guard");
const { compareCipher, encrypt } = require("../../utils/encryption");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../utils/generateToken");
const { createTokenEntity } = require("../../token-service/controllers/token");

//signup
const createGuard = async (data) => {
  const reference = "createGuard";
  if (!data.password || data.password.length < 6) {
    throw new AppError(reference, "Invalid Body", "custom", 412, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }
  if (
    !data.buildings ||
    !Array.isArray(data.buildings) ||
    !data.buildings?.length
  ) {
    throw new AppError(reference, "Buildings are required", "custom", 412);
  }

  //validate unique columns
  const [findGuardFromUserName, findGuardFromMobile] = await Promise.all([
    getGuard({ userName: data.userName }),
    getGuard({ mobileNumber: data.mobileNumber }),
  ]);
  if (findGuardFromUserName) {
    throw new AppError(reference, "User name already exists", "custom", 412);
  }

  if (findGuardFromMobile) {
    throw new AppError(
      reference,
      "Mobile number already exists",
      "custom",
      412
    );
  }

  await Promise.all(
    data.buildings.map(async (id) => {
      if (!(await getBuilding({ id, propertyId: data.propertyId }))) {
        throw new AppError(
          reference,
          "Selected building not found",
          "custom",
          404
        );
      }
    })
  );
  data.isActive = true;
  data.alternateContact = {
    countryCode: data.alternateCountryCode ? data.alternateCountryCode : null,
    mobileNumber: data.alternateMobileNumber
      ? data.alternateMobileNumber
      : null,
    email: data.alternateEmail ? data.alternateEmail : null,
  };
  data.pocContact = {
    countryCode: data.pocCountryCode ? data.pocCountryCode : null,
    mobileNumber: data.pocMobileNumber ? data.pocMobileNumber : null,
    email: data.pocEmail ? data.pocEmail : null,
  };
  let guard;
  try {
    guard = await Guard.create(data);
  } catch (error) {
    guard = await Guard.findOne({
      where: {
        [Op.or]: [
          { mobileNumber: data.mobileNumber },
          { userName: data.userName },
        ],
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });

    if (!guard) {
      throw error;
    }

    for (const key in JSON.parse(JSON.stringify(guard))) {
      guard[key] = null;
    }

    for (const key in data) {
      guard[key] = data[key];
    }
    guard.isActive = true;
    await guard.save();
    await guard.restore();
  }
  await GuardBuilding.bulkCreate(
    data.buildings.map((buildingId) => {
      return { buildingId, guardId: guard.id };
    })
  );
  return null;
};

//login
const loginGuard = async (data) => {
  let userName = data.userName ? data.userName : "";
  let mobileNumber = data.mobileNumber ? data.mobileNumber : "";

  const findGuard = await Guard.scope(null).findOne({
    where: { [Op.or]: [{ userName }, { mobileNumber }] },
  });
  if (!findGuard) {
    throw new AppError("loginGuard", "Invalid Body", "custom", 200, [
      {
        column: "username",
        message: "Guard not found",
      },
    ]);
  }

  if (!findGuard.isActive) {
    throw new AppError(
      "loginGuard",
      "Account is In-Active. Please contact Admin",
      "custom",
      420
    );
  }

  const checkPassword = compareCipher(data.password, findGuard.password);
  if (!checkPassword) {
    throw new AppError("loginGuard", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }
  if (!findGuard.isActive) {
    throw new AppError("loginGuard", "Invalid Body", "custom", 200, [
      {
        column: "isActive",
        message: "Profile not active. Please contact admin",
      },
    ]);
  }
  const [refreshToken, accessToken] = await Promise.all([
    generateRefreshToken(findGuard.id, USER_TYPES.GUARD),
    generateAccessToken(findGuard.id, USER_TYPES.GUARD),
  ]);

  if (!data.refreshRequired) {
    return accessToken;
  }
  await createTokenEntity({ token: refreshToken, guardId: findGuard.id });
  return {
    accessToken,
    refreshToken,
    userType: USER_TYPES.GUARD,
  };
};

const deleteGuard = async (params) => {
  const reference = "deleteGuard";
  const guard = await getGuard(params);
  if (!guard) {
    throw new AppError(reference, "Guard not found", "custom", 404);
  }
  await guard.destroy();
  return null;
};

const changeGuardPassword = async (data) => {
  if (!data.currentPassword || !data.newPassword) {
    throw new AppError(
      "changeGuardPassword",
      "Current Password and New Password are required"
    );
  }
  const guard = await Guard.scope(null).findByPk(data.id);
  if (!compareCipher(data.currentPassword, guard.password)) {
    throw new AppError("changeGuardPassword", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }
  if (
    data.newPassword.length <= 5 ||
    data.newPassword == data.currentPassword
  ) {
    throw new AppError("changeGuardPassword", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }
  guard.password = encrypt(data.newPassword);

  await guard.save();

  return;
};

module.exports = { createGuard, loginGuard, changeGuardPassword, deleteGuard };
