const OwnerPushDevice = require("../models/OwnerPushDevice");

/**
 * @function addOwnerToken
 * @param {import("../types").IAddOwnerToken} data
 * @returns {Promise<null>}
 * @description Function to add owner's FCM token
 */
const addOwnerToken = async (data) => {
  await OwnerPushDevice.create(data);
  return null;
};

/**
 * @function removeOwnerToken
 * @param {import("../types").IRemoveOwnerToken} params
 * @returns {Promise<null>}
 * @description Function to remove owner's FCM token
 */
const removeOwnerToken = async (params) => {
  await OwnerPushDevice.destroy({
    where: params,
  });
  return null;
};

module.exports = { addOwnerToken, removeOwnerToken };
