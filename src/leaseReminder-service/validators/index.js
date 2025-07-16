const Joi = require("joi");
const {
  SCHEDULING_TYPES,
  LEASE_REMINDER_STATUSES,
} = require("../../config/constants");
const moment = require("moment-timezone");

exports.createLeaseReminderSchema = Joi.object({
  leaseIds: Joi.array()
    .items(Joi.string().uuid({ version: "uuidv4" }))
    .min(1)
    .required(),
  scheduledTime: Joi.date().min("now").required(),
  smsTitle: Joi.when("scheduledFor", {
    is: Joi.valid(SCHEDULING_TYPES.SMS, SCHEDULING_TYPES.BOTH),
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  smsBody: Joi.when("scheduledFor", {
    is: Joi.valid(SCHEDULING_TYPES.SMS, SCHEDULING_TYPES.BOTH),
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  scheduledFor: Joi.string()
    .valid(...Object.values(SCHEDULING_TYPES))
    .required(),
})
  .unknown(false)
  .custom((value, helpers) => {
    const { leaseIds, scheduledTime, smsTitle, smsBody, scheduledFor } = value;

    const newValue = leaseIds.map((id) => ({
      leaseId: id,
      scheduledTime,
      smsTitle,
      smsBody,
      scheduledFor,
    }));
    return newValue;
  });

exports.getLeaseRemindersSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  startDate: Joi.date(),
  endDate: Joi.date()
    .min(Joi.ref("startDate"))
    .custom((value, helpers) => {
      value.setHours(23, 59, 59, 999);
      return value;
    }),
  search: Joi.string(),
  status: Joi.string().valid(...Object.values(LEASE_REMINDER_STATUSES)),
}).and("startDate", "endDate");

exports.instantLeaseReminderSchema = Joi.object({
  leaseId: Joi.string().uuid({ version: "uuidv4" }).required(),
})
  .custom((value, helpers) => {
    const currentDate = moment().utc();
    value["cronTime"] = currentDate.format("YYYY-MM-DD HH:mm:ss.SSS Z");
    return value;
  })
  .unknown(false);
