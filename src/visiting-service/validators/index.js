const Joi = require("joi");
const {
  VISITOR_CATEGORIES,
  VISITING_STATUSES,
} = require("../../config/constants");
const moment = require("moment-timezone")

module.exports.getVisitorLogsSchema = Joi.object({
  search: Joi.string(),
  category_en: Joi.string().valid(...Object.values(VISITOR_CATEGORIES)),
  companyId: Joi.string().uuid({ version: "uuidv1" }),
  checkInDate: Joi.string(),
  checkOutDate: Joi.string(),
  status: Joi.string().valid(...Object.values(VISITING_STATUSES)),
  flatIds: Joi.array().items(Joi.string().uuid({ version: "uuidv1" })),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
});

module.exports.getVisitorLogsNewSchema = Joi.object({
  search: Joi.string(),
  categoryId: Joi.string().uuid({ version: "uuidv1" }),
  companyId: Joi.string().uuid({ version: "uuidv1" }),
  categoryName:Joi.string(),
  checkInDate: Joi.date(),
  checkOutDate: Joi.date(),
  status: Joi.string().valid(...Object.values(VISITING_STATUSES)),
  flatIds: Joi.array().items(Joi.string().uuid({ version: "uuidv1" })),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
}).custom((value,helper)=>{
  if(value.checkInDate){
    value.checkInDate = moment(value.checkInDate).startOf("day").toDate();  
  }
  if(value.checkOutDate){
    value.checkOutDate = moment(value.checkOutDate).endOf("day").toDate();
  }
  return value
})

