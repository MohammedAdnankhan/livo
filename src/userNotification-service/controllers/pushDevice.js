const PushDevice = require("../models/PushDevice");
const env = process.env.NODE_ENV || "development";
const fcmConfig = require("../../config/pushNotification.json")[env];
const gcm = require("node-gcm");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const { ACTION_TYPES } = require("../../config/constants");

const sendFcmToken = async ({ userId, deviceType, token }) => {
  if (!deviceType || !token) {
    throw new AppError("", "Device type and token are required");
  }
  let requestBody = {};
  requestBody.deviceType = deviceType;
  requestBody.token = token;
  requestBody.userId = userId;

  await PushDevice.destroy({
    where: { token: requestBody.token },
    force: true,
  });

  const newToken = await PushDevice.create(requestBody);

  return newToken[0];
};

const pushNotification = async (
  { message, title, tag, icon, sourceType, sourceId, userId },
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

  const dataResponseActions = new Array(
    ACTION_TYPES.ENTRY_REQUESTED.key,
    ACTION_TYPES.ENTRY_APPROVED.key,
    ACTION_TYPES.ENTRY_DENIED.key
  );

  if (!dataResponseActions.includes(title)) {
    gcmMessage.addNotification("title", "Livo");
    gcmMessage.addNotification("body", message);
    gcmMessage.addNotification("icon", icon);
    gcmMessage.addNotification("tag", tag);
  } else {
    gcmMessage.addData("body", message);
  }

  gcmMessage.addData("sourceType", sourceType);
  gcmMessage.addData("sourceId", sourceId);
  gcmMessage.addData("action", title);

  logger.info(`message: ${JSON.stringify(gcmMessage)}`);

  //get tokens
  const deviceTokens = await PushDevice.findAll({
    where: { userId },
    attributes: attributes.length ? attributes : null,
  });

  const regTokens = deviceTokens.map((deviceToken) => deviceToken.token);

  if (!regTokens.length) {
    logger.error(
      `pushNotification(): Device Token Not Found for userId ${userId}`
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
  await PushDevice.destroy({
    where: { token },
    force: true,
  });
  return;
};

const removeUserToken = async (params) => {
  await PushDevice.destroy({
    where: params,
    force: true,
  });
  return null;
};

// pushNotification({
//   title: "Notification Test",
//   message: "From Backend",
//   icon: "sdasd",
//   sourceId: "sdasdsss",
//   tag: "wdqdd",
//   sourceType: "mmkk",
//   userId: "2388f76b-64d7-45e7-a690-5d3aee001447",
// });

module.exports = {
  sendFcmToken,
  pushNotification,
  removeFcmToken,
  removeUserToken,
};
