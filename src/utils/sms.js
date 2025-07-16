const axios = require("axios").default;
const env = process.env.NODE_ENV || "development";
const smsConfig = require("../config/sms.json")[env];

const sendSMS = async (mobileNumber, message) => {
  const {
    SERVICE_PLAN_ID: servicePlanId,
    API_TOKEN: apiToken,
    SINCH_NUMBER: sinchNumber,
  } = smsConfig;
  try {
    await axios({
      url: `https://us.sms.api.sinch.com/xms/v1/${servicePlanId}/batches`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      data: {
        from: sinchNumber,
        to: [mobileNumber],
        body: message,
      },
    });
    return;
  } catch (error) {
    throw error;
  }
};

module.exports = { sendSMS };
