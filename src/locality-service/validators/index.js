const Joi = require("joi");

exports.createLocalitySchema = Joi.object({
  name_en: Joi.string().required(),
  name_ar: Joi.string().default(Joi.x("{{name_en}}_ar")),
  cityId: Joi.string().uuid().required(),
});
