const Joi = require("joi");
const { VISITOR_CATEGORIES } = require("../../config/constants");

module.exports.addVisitorTypeSchema = Joi.object({
  category_en: Joi.string().required(),
  company_en: Joi.string(),
  image: Joi.string().uri(),
}).custom((value, helpers) => {
  value.category_en = value.category_en;
  value.category_ar = `${value.category_en}_ar`;
  value.image = value.image;
  if (value.company_en) {
    value.company_en = value.company_en;
    value.company_ar = `${value.company_en}_ar`;
  }
  return value;
});

module.exports.addVisitorCompanySchema = Joi.object({
  category_id: Joi.string().uuid({ version: "uuidv1" }).required(),
  company_en: Joi.string().required(),
  image: Joi.string().uri().required(),
});

module.exports.updateVisitorCompanySchema = Joi.object({
  category_id: Joi.string().uuid().required(),
  company_en: Joi.string(),
  image: Joi.string().uri(),
  updated_category_id: Joi.string().uuid(),
});

module.exports.toggleVisitorCompanySchema = Joi.object({
  category_id: Joi.string().uuid({ version: "uuidv1" }).required(),
});

module.exports.updateVisitorTypeVisibilitySchema = Joi.object({
  // category_en: Joi.string(),
  // company_en: Joi.string(),
  // image: Joi.string().uri(),
  isVisible: Joi.boolean(),
});

module.exports.getVisitorTypeListing = Joi.object({
  search: Joi.string(),
});

module.exports.getVisitorTypeByVisitorIdSchema = Joi.object({
  visitorId: Joi.string().uuid({ version: "uuidv1" }),
});
