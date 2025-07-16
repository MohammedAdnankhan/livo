const Joi = require("joi");

module.exports.addTagsSchema = Joi.object({
  name: Joi.string().min(2).required(),
});

module.exports.getTagsSchema = Joi.object({
  search: Joi.string(),
});
