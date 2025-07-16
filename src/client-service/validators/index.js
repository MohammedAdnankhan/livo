const Joi = require("joi");
const { clientIdentificationValues } = require("../../config/constants");

module.exports.clientRegistrationSchema = Joi.object({
  clientId: Joi.string().uuid().required(),
  clientSecret: Joi.string().required(),
  userIdType: Joi.string()
    .valid(...Object.values(clientIdentificationValues))
    .required(),
  userIdValue: Joi.string().required(),
  flatId: Joi.string().uuid().required(),
}).unknown(false);
