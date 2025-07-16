const Staff = require("../models/Staff");
const { USER_TYPES } = require("../../config/constants");
const { AppError } = require("../../utils/errorHandler");

const { compareCipher } = require("../../utils/encryption");
const {
  generateRefreshToken,
  generateAccessToken,
} = require("../../utils/generateToken");
const { createTokenEntity } = require("../../token-service/controllers/token");

//login
module.exports.loginStaff = async (data) => {
  const reference = "loginStaff";
  const findStaff = await Staff.findOne({
    where: { mobileNumber: data.mobileNumber },
  });
  if (!findStaff) {
    throw new AppError(reference, "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Staff not found",
      },
    ]);
  }

  const checkPassword = compareCipher(data.password, findStaff.password);
  if (!checkPassword) {
    throw new AppError("password", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }

  const [refreshToken, accessToken] = await Promise.all([
    generateRefreshToken(findStaff.id, USER_TYPES.STAFF),
    generateAccessToken(findStaff.id, USER_TYPES.STAFF),
  ]);

  await createTokenEntity({ token: refreshToken, staffId: findStaff.id });
  return {
    accessToken,
    refreshToken,
    userType: USER_TYPES.STAFF,
  };
};
