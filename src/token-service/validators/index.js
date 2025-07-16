const Joi = require("joi");

/**
 * Schema object to generate new tokens
 */
exports.generateTokensSchema = Joi.object({
  refreshToken: Joi.string().required(),
}).unknown(false);
