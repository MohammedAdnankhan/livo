const AdminPushDevice = require("../models/adminPushDevice");
const env = process.env.NODE_ENV || "development";
const fcmConfig = require("../../config/pushNotification.json")[env];
const gcm = require("node-gcm");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");

const sendFcmToken = async ({ adminId, token }) => {
  if (!token) {
    throw new AppError("", "token is required");
  }
  let requestBody = {};
  requestBody.token = token;
  requestBody.adminId = adminId;

  await AdminPushDevice.destroy({
    where: { token: requestBody.token },
    force: true,
  });

  const newToken = await AdminPushDevice.create(requestBody);

  return newToken[0];
};

const pushNotification = async (
  { message, title, tag, icon, sourceType, sourceId, adminId },
  attributes = ["token"]
) => {
  if (!message || !title) {
    throw new AppError("pushNotification", "Title and message are required");
  }
  const sender = new gcm.Sender(fcmConfig.FCM_SERVER_KEY);

  const gcmMessage = new gcm.Message({
    dryRun: false,
    priority: "high",
    contentAvailable: true,
  });

  gcmMessage.addNotification("title", "Livo");
  gcmMessage.addNotification("body", message);
  gcmMessage.addNotification("icon", icon);
  gcmMessage.addNotification("tag", tag);
  gcmMessage.addData("sourceType", sourceType);
  gcmMessage.addData("sourceId", sourceId);
  gcmMessage.addData("action", title);

  logger.info(`message: ${JSON.stringify(gcmMessage)}`);

  //get tokens
  const deviceTokens = await AdminPushDevice.findAll({
    where: { adminId },
    attributes: attributes.length ? attributes : null,
  });

  const regTokens = deviceTokens.map((deviceToken) => deviceToken.token);

  if (!regTokens.length) {
    logger.error(
      `pushNotification(): Device Token Not Found for adminId ${adminId}`
    );
    return;
  }

  //send the message
  sender.send(
    gcmMessage,
    {
      registrationTokens: regTokens,
    },
    function (err, response) {
      if (err) {
        logger.error(`pushNotification(): ${err.message}`);
        console.log(err);
      } else {
        logger.info(`response: ${JSON.stringify(response)}`);
      }
    }
  );
};

const removeFcmToken = async ({ token }) => {
  if (!token) {
    throw new AppError("removeFcmToken", "Device token is required");
  }
  await AdminPushDevice.destroy({
    where: { token },
    force: true,
  });
  return;
};

const removeAdminToken = async (params) => {
  await AdminPushDevice.destroy({
    where: params,
    force: true,
  });
  return null;
};

module.exports = {
  sendFcmToken,
  pushNotification,
  removeFcmToken,
  removeAdminToken,
};
