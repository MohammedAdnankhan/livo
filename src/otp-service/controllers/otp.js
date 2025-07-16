const { default: axios } = require("axios");
const logger = require("../../utils/logger");
const { AppError } = require("../../utils/errorHandler");
const { isValidPhoneNumber } = require("../../utils/utility");
const env = process.env.NODE_ENV || "development";
const smsConfig = require("../../config/sms.json")[env];
const accountSid = smsConfig.ACCOUNT_SID;
const authToken = smsConfig.TWILIO_AUTH_TOKEN;
const messagingServiceId = smsConfig.SERVICE_ID;
const client = require("twilio")(accountSid, authToken, {
  lazyLoading: true,
});
const Otp = require("../../otp-service/models/Otp");

const sendOTP = async (data) => {
  if (!isValidPhoneNumber(data.mobileNumber))
    throw new AppError("sendOTP", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Enter valid mobile number",
      },
    ]);

  try {
    if (env === "development") {
      return;
    }
    await client.verify.v2.services(messagingServiceId).verifications.create({
      to: `+${data.mobileNumber}`,
      channel: "sms",
    });
  } catch (error) {
    logger.error(JSON.stringify(error.message));
    throw new AppError("sendOTP", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Enter valid mobile number",
      },
    ]);
  }
};

const verifyOtp = async (data) => {
  if (!isValidPhoneNumber(data.mobileNumber)) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Invalid Mobile Number",
      },
    ]);
  }
  if (!data.otp) {
    throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
      {
        column: "otp",
        message: "OTP is required",
      },
    ]);
  }
  if (env == "development") {
    if (data.otp != "1111") {
      throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
        {
          column: "otp",
          message: "Enter valid OTP",
        },
      ]);
    }
    return;
  }

  // const token = smsConfig.AUTH_TOKEN;
  // const requestOptions = {
  //   url: `https://verificationapi-v1.sinch.com/verification/v1/verifications/number/+${data.mobileNumber}`,
  //   method: "PUT",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Basic ${token}`,
  //   },
  //   data: { method: "sms", sms: { code: data.otp } },
  // };
  try {
    // const response = await axios(requestOptions);
    const otp = data.otp;

    const response = await client.verify.v2
      .services(messagingServiceId)
      .verificationChecks.create({
        to: `+${data.mobileNumber}`,
        code: otp,
      });
    if (response.status == "approved" && response.valid === true) {
      return;
    } else if (response.status == "pending" && response.valid === false) {
      throw new AppError("verifyOtp", "Invalid Otp", "custom", 200);
    }
  } catch (error) {
    throw new AppError("verifyOtp", "Otp incorrect or expired", "custom", 200);
    // if (error.response) {
    //   throw new AppError("verifyOtp", error.response.data.message);
    // } else if (error.request) {
    //   logger.error(JSON.stringify(error.request));
    // } else {
    //   logger.error(JSON.stringify(error.message));
    // }
    // throw error;
  }
};

const verifyTwilioOtp = async (data) => {
  if (!isValidPhoneNumber(data.mobileNumber)) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Invalid Mobile Number",
      },
    ]);
  }
  if (!data.otp) {
    throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
      {
        column: "otp",
        message: "OTP is required",
      },
    ]);
  }
  if (!data.secretKey) {
    throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
      {
        column: "secretKey",
        message: "secretKey is required",
      },
    ]);
  }

  // const secret = await Otp.findOne({ where: { secretKey: data.secretKey } });
  // if (secret) {
  //   throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
  //     {
  //       column: "secretKey",
  //       message: "secretKey should be unique",
  //     },
  //   ]);
  // }
  if (env == "development") {
    if (data.otp != "1111") {
      throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
        {
          column: "otp",
          message: "Enter valid OTP",
        },
      ]);
    }
    await Otp.create({
      secretKey: data.secretKey,
      otp: data.otp,
      mobileNumber: data.mobileNumber,
    });
    return;
  }

  // const token = smsConfig.AUTH_TOKEN;
  // const requestOptions = {
  //   url: `https://verificationapi-v1.sinch.com/verification/v1/verifications/number/+${data.mobileNumber}`,
  //   method: "PUT",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Basic ${token}`,
  //   },
  //   data: { method: "sms", sms: { code: data.otp } },
  // };
  try {
    // const response = await axios(requestOptions);
    const otp = data.otp;

    const response = await client.verify.v2
      .services(messagingServiceId)
      .verificationChecks.create({
        to: `+${data.mobileNumber}`,
        code: otp,
      });
    if (response.status == "approved" && response.valid === true) {
      await Otp.create({
        secretKey: data.secretKey,
        otp,
        mobileNumber: data.mobileNumber,
      });
      return;
    } else if (response.status == "pending" && response.valid === false) {
      throw new AppError("verifyOtp", "Invalid Otp", "custom", 200);
    }
  } catch (error) {
    throw new AppError("verifyOtp", "Otp incorrect or expired", "custom", 200);
    // if (error.response) {
    //   throw new AppError("verifyOtp", error.response.data.message);
    // } else if (error.request) {
    //   logger.error(JSON.stringify(error.request));
    // } else {
    //   logger.error(JSON.stringify(error.message));
    // }
    // throw error;
  }
};

const verifyOtpWithSecret = async (data) => {
  const secret = await Otp.findOne({ where: data });
  if (!secret) {
    throw new AppError("verifyOtp", "Invalid Body", "custom", 200, [
      {
        column: "verifyOtp",
        message: "Otp incorrect or expired",
      },
    ]);
  }
  await secret.destroy();
  return;
};

module.exports = { sendOTP, verifyOtp, verifyOtpWithSecret, verifyTwilioOtp };
