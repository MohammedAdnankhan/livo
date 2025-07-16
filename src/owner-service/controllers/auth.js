const Owner = require("../models/Owner");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { AppError } = require("../../utils/errorHandler");
const { USER_TYPES } = require("../../config/constants");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../utils/generateToken");
const { sendOTP, verifyOtp } = require("../../otp-service/controllers/otp");
const { getOwner } = require("./owner");
const { validatePassword, hashPassword } = require("../../utils/utility");
const { createTokenEntity } = require("../../token-service/controllers/token");

const loginOwner = async (data) => {
  const username = data.username;
  const password = data.password;

  const findOwner = await Owner.scope(null).findOne({
    where: {
      [Op.or]: [{ email: username }, { mobileNumber: username }],
    },
  });

  if (!findOwner) {
    throw new AppError("loginOwner", "Owner not found", "custom", 200, [
      {
        column: "username",
        message: "Owner not found",
      },
    ]);
  }

  const checkPassword = await bcrypt.compare(password, findOwner.password);
  if (!checkPassword) {
    throw new AppError("loginOwner", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }
  const [refreshToken, accessToken] = await Promise.all([
    generateRefreshToken(findOwner.id, USER_TYPES.OWNER),
    generateAccessToken(findOwner.id, USER_TYPES.OWNER),
  ]);

  await createTokenEntity({ token: refreshToken, ownerId: findOwner.id });
  return { accessToken, refreshToken, userType: USER_TYPES.OWNER };
};

/**
 * @function resetPasswordOtp
 * @param {string} mobileNumber
 * @returns {Promise<null>}
 * @description Function to send OTP when resetting password
 */
const resetPasswordOtp = async (mobileNumber) => {
  const reference = "resetPasswordOtp";
  const owner = await getOwner({ mobileNumber });
  if (!owner) {
    throw new AppError(reference, "Owner not found", "custom", 404);
  }

  await sendOTP({ mobileNumber });
  return null;
};

/**
 * @function resetPassword
 * @param {import("../types").IResetPassword} data
 * @returns {Promise<null>}
 * @description Function to reset owner's password using OTP verification
 */
const resetPassword = async (data) => {
  const reference = "resetPassword";
  const owner = await getOwner({ mobileNumber: data.mobileNumber }, null);
  if (!owner) {
    throw new AppError(reference, "Owner not found!", "custom", 404);
  }
  try {
    const otpVerificationPayload = {
      mobileNumber: data.mobileNumber,
      otp: data.otp,
    };
    await verifyOtp(otpVerificationPayload);
  } catch (error) {
    //TODO: validate error and throw custom message accordingly
    throw error;
  }

  if (await validatePassword(data.password, owner.password)) {
    throw new AppError(
      reference,
      "New password cannot be same as previous password",
      "custom",
      412
    );
  }
  owner.password = await hashPassword(data.password);
  await owner.save();
  return null;
};

module.exports = {
  loginOwner,
  resetPasswordOtp,
  resetPassword,
};
