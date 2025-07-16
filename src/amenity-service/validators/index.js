const Joi = require("joi");
const { AMENITIES_FOR } = require("../../config/constants");

//*Add amenity
module.exports.createAmenitySchema = Joi.object({
  image: Joi.string().uri(),
  name: Joi.string().required(),
  raisedFor: Joi.string()
    .valid(...Object.values(AMENITIES_FOR))
    .required(),
}).unknown(false);

//*Get amenity list
module.exports.getAmenitiesListSchema = Joi.object({
  raisedFor: Joi.string()
    .valid(...Object.values(AMENITIES_FOR))
    .required(),
}).unknown(false);

//*get amenities
module.exports.getAmenitiesSchema = Joi.object({
  search: Joi.string().optional(),
}).unknown(false);

module.exports.getAmenityByIdSchema = Joi.object({
  amenityId: Joi.string().uuid({ version: "uuidv4" }),
});

module.exports.updateAmenitySchema = Joi.object({
  image: Joi.string().uri(),
  name: Joi.string(),
  raisedFor: Joi.string().valid(...Object.values(AMENITIES_FOR)),
});
