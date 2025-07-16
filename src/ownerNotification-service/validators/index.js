const Joi = require("joi");
const { DEVICE_TYPES } = require("../../config/constants");

exports.createOwnerToken = Joi.object({
  deviceType: Joi.string()
    .valid(...Object.values(DEVICE_TYPES))
    .required(),
  token: Joi.string().required(),
}).unknown(false);

exports.deleteOwnerToken = Joi.object({
  token: Joi.string().required(),
}).unknown(false);
