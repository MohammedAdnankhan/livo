const Joi = require("joi");
const {
  MAINTENANCE_REQUESTED_BY,
  MAINTENANCE_STATUSES,
  TIMEZONES,
  BILLED_FOR,
} = require("../../config/constants");
const moment = require("moment-timezone");

exports.getOwnerRequestsSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  category: Joi.string().optional(),
  isUrgent: Joi.boolean(),
  isBuilding: Joi.boolean(),
  generatedBy: Joi.string().valid(...Object.values(MAINTENANCE_REQUESTED_BY)),
  status: Joi.string().valid(...Object.keys(MAINTENANCE_STATUSES)),
  search: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref("startDate")),
});

exports.getRequestCategoriesByFlatSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).optional(),
});

const formPreferredTimeAndInsertFlatId = (value, _helpers) => {
  const { flatId, requests } = value;

  requests.forEach((request) => {
    request.flatId = flatId;
    const startTime = moment.utc(request.time).set({
      minute: "00",
      second: "00",
      millisecond: "00",
    });
    const endTime = moment(startTime).add(1, "h");

    request.preferredTime = {
      start: startTime.toDate(),
      end: endTime.toDate(),
    }; //TODO: test time management
  });
  return requests;
};

exports.createMultipleRequestsSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).required(),
  requests: Joi.array()
    .items(
      Joi.object({
        categoryId: Joi.string().uuid({ version: "uuidv4" }).required(),
        subCategoryId: Joi.string().default(Joi.x("{{categoryId}}")),
        time: Joi.date().min("now").required(),
        comment: Joi.string().optional(),
        files: Joi.array().items(Joi.string().uri()).optional(),
        isBuilding: Joi.boolean().required(),
        isUrgent: Joi.boolean().required(),
        description: Joi.string().optional(),
      }).unknown(false)
    )
    .required(),
})
  .unknown(false)
  .custom(
    formPreferredTimeAndInsertFlatId,
    "Preferred Time Formation And Flat Insertion"
  );

exports.cancelRequestSchema = Joi.object({
  flatId: Joi.string().uuid().required(),
  requestId: Joi.string().uuid().required(),
  comment: Joi.string().required(),
}).unknown(false);

exports.flatIdValidationSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).required(),
}).unknown(false);

exports.maintenanceIdValidationSchema = Joi.object({
  maintenanceId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.updateRequestSchema = Joi.object({
  flatId: Joi.string().uuid().required(),
  description: Joi.string(),
  categoryId: Joi.string().uuid({ version: "uuidv4" }),
  time: Joi.date().min("now"),
  files: Joi.array().items(Joi.string().uri()),
  isUrgent: Joi.boolean(),
})
  .unknown(false)
  .custom((value, _helpers) => {
    const { time } = value;
    if (time) {
      const startTime = moment.utc(time).set({
        minute: "00",
        second: "00",
        millisecond: "00",
      }); //FIXME: Fix incorrect date issue in case of IST timezone
      const endTime = moment(startTime).add(1, "h");

      value.preferredTime = {
        start: startTime.toDate(),
        end: endTime.toDate(),
      };
    }
    return value;
  });

exports.feedbackRequestSchema = Joi.object({
  rating: Joi.number().required().min(1).max(5),
  feedback: Joi.string().required(),
  flatId: Joi.string().uuid().required(),
  requestId: Joi.string().uuid().required(),
}).unknown(false);

exports.getRequestStatusesCountSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  buildingId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  category: Joi.string().optional(),
  status: Joi.string().valid(...Object.keys(MAINTENANCE_STATUSES)),
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref("startDate")),
});

exports.updateFilesOnRequestsSchema = Joi.object({
  files: Joi.array()
    .required()
    .items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        url: Joi.string().uri().required(),
        uid: Joi.string().optional(),
      }).unknown(false)
    )
    .min(1),
}).unknown(false);

exports.getRequestByRequestIdSchema = Joi.object({
  requestId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.getProductByProductIdSchema = Joi.object({
  productId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.updateProductByProductIdSchema = Joi.object({
  billedFor: Joi.string()
    .valid(...Object.values(BILLED_FOR))
    .optional(),
  quantity: Joi.number().optional(),
}).unknown(false);

module.exports.getAssignedRequestsSchema = Joi.object({
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref("startDate")),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  categoryId: Joi.string().uuid({ version: "uuidv4" }),
  flatId: Joi.string().uuid({ version: "uuidv1" }),
})
  .and("startDate", "endDate")
  .unknown(false);

module.exports.getAssignedRequestByIdSchema = Joi.object({
  requestId: Joi.string().uuid({ version: "uuidv4" }),
}).unknown(false);
