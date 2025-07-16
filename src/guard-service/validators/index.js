const Joi = require("joi");
const { GENDERS, GUARD_STATUSES } = require("../../config/constants");

exports.getGuardByGuardIdSchema = Joi.object({
  guardId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.updateGuardByIdSchema = Joi.object({
  buildings: Joi.array().items(
    Joi.string().uuid({ version: "uuidv1" }).required()
  ),
  userName: Joi.string().optional(),
  name: Joi.string().optional(),
  email: Joi.string().optional(),
  mobileNumber: Joi.string().optional(),
  gender: Joi.string().valid(...Object.values(GENDERS)),
  profilePicture: Joi.string().uri().optional(),
  countryCode: Joi.string().optional(),
  company: Joi.string().optional(),
  documentType: Joi.string().optional(),
  documentId: Joi.string().optional(),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(), //Used By FE in ANT-D
    }).unknown(false)
  ),
  nationality: Joi.string().optional(),
  password: Joi.string().optional(),
  alternateCountryCode: Joi.string().optional(),
  alternateMobileNumber: Joi.string().optional(),
  alternateEmail: Joi.string().optional(),
  pocCountryCode: Joi.string().optional(),
  pocMobileNumber: Joi.string().optional(),
  pocEmail: Joi.string().optional(),
});

exports.guardLoginSchema = Joi.object({
  userName: Joi.string(),
  mobileNumber: Joi.string(),
  password: Joi.string().required(),
  refreshRequired: Joi.boolean(),
}).xor("userName", "mobileNumber");

module.exports.getGuardsSchema = Joi.object({
  search: Joi.string(),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  status: Joi.string().valid(...Object.values(GUARD_STATUSES)),
  company: Joi.string(),
});
