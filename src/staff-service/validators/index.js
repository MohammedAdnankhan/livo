const Joi = require("joi");

exports.staffLoginSchema = Joi.object({
  mobileNumber: Joi.string().required(),
  password: Joi.string().min(5).max(20).required(),
});
