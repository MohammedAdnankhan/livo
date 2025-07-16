const Joi = require("joi");

exports.getNoticeByNoticeIdSchema = Joi.object({
  noticeId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.getNoticesForOwnerSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }).optional(),
}).unknown(false);
