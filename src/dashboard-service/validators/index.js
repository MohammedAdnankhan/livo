const Joi = require("joi");
const { VISITOR_CATEGORIES } = require("../../config/constants");

exports.getAnalyticsSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .required()

    .min(Joi.ref("startDate")),

  buildingId: Joi.string().uuid(),
});

exports.getVisitorAnalyticsSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .required()

    .min(Joi.ref("startDate")),

  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  categoryId: Joi.string().uuid({ version: "uuidv1" }),
  categoryName: Joi.string(),
});

exports.getVisitorStatisticsSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .required()

    .min(Joi.ref("startDate")),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
});

exports.getOwnerStatisticsSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
});
