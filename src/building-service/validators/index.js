const Joi = require("joi");
const { BUILDING_TYPES } = require("../../config/constants");

exports.getOwnerBuildingsSchema = Joi.object({
  search: Joi.string().optional(),
}).unknown(false);

exports.getBuildingFromBuildingIdSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }).required(),
});

exports.getBuildingsSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  buildingType: Joi.string().valid(...Object.values(BUILDING_TYPES)),
  localityId: Joi.string().uuid({ version: "uuidv1" }),
  cityId: Joi.string().uuid({ version: "uuidv4" }),
  country: Joi.string(),
  search: Joi.string(),
  list: Joi.string().valid("new"),
});
