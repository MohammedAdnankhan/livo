const Joi = require("joi");
const { LANGUAGES, USER_ROLES } = require("../../config/constants");
const { hashPassword } = require("../../utils/utility");

module.exports.signupUserQuerySchema = Joi.object({
  newTrigger: Joi.boolean().optional(),
}).unknown(false);

module.exports.signupUserSchema = Joi.object({
  name: Joi.string().required(),
  flatId: Joi.string().uuid().required(),
  email: Joi.string().required(),
  secretKey: Joi.string().optional(),
  countryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .required()
    .error(new Error("countryCode should consist of only digits")),
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .required()
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  password: Joi.string().min(6).required(),
  profilePicture: Joi.any(),
  language: Joi.string().default(LANGUAGES.EN),
  role: Joi.string().default(USER_ROLES.RESIDENT),
  otp: Joi.number().required(),
})
  .unknown(false)
  .custom((value, _helpers) => {
    value["otp"] = value["otp"].toString();
    return value;
  });
