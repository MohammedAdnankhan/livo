const Joi = require("joi");
const {
  FLAT_USAGE,
  PAYMENT_FREQUENCIES,
  PAYMENT_MODES,
  DISCOUNT_APPLICABILITY,
  PAYMENT_FREQUENCY_VALUES,
  DISCOUNT_TYPES,
  LEASE_STATUSES,
} = require("../../config/constants");

/**
 * Schema object to create a draft lease
 */
exports.createLeaseSchema = Joi.object({
  masterUserId: Joi.string().uuid({ version: "uuidv4" }).required(),
  flatId: Joi.string().uuid({ version: "uuidv1" }),
  subFlatId: Joi.string().uuid({ version: "uuidv4" }),
  paymentDetailsRequired: Joi.boolean().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  moveInDate: Joi.date(),
  moveOutDate: Joi.date(),
  paymentFrequency: Joi.when("paymentDetailsRequired", {
    is: true,
    then: Joi.string()
      .valid(...Object.values(PAYMENT_FREQUENCIES))
      .required(),
    otherwise: Joi.forbidden(),
  }),
  securityDeposit: Joi.when("paymentDetailsRequired", {
    is: true,
    then: Joi.number().required(),
    otherwise: Joi.forbidden(),
  }),
  currency: Joi.when("paymentDetailsRequired", {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  paymentMode: Joi.when("paymentDetailsRequired", {
    is: true,
    then: Joi.string()
      .valid(...Object.values(PAYMENT_MODES))
      .required(),
    otherwise: Joi.forbidden(),
  }),
  flatUsage: Joi.string()
    .valid(...Object.values(FLAT_USAGE))
    .required(),
  rentAmount: Joi.when("paymentDetailsRequired", {
    is: true,
    then: Joi.number().required(),
    otherwise: Joi.forbidden(),
  }),
  activationFee: Joi.when("paymentDetailsRequired", {
    is: true,
    then: Joi.number().required(),
    otherwise: Joi.forbidden(),
  }),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(),
    }).unknown(false)
  ),
  ownerId: Joi.string().uuid({ version: "uuidv4" }),
  isDiscountRequired: Joi.boolean().required(),
  discountApplicability: Joi.string()
    .valid(...Object.values(DISCOUNT_APPLICABILITY))
    .when("isDiscountRequired", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  amenities: Joi.array().items(
    Joi.object({
      itemName: Joi.string().required(),
      quantity: Joi.number().required(),
      itemIds: Joi.array().items(Joi.string()),
      description: Joi.string(),
    })
  ),
  terms: Joi.array().items(Joi.string()),
  noticePeriod: Joi.number().max(10),
  description: Joi.string(),
})
  .when(".discountApplicability", [
    {
      is: DISCOUNT_APPLICABILITY.GRACE,
      then: Joi.object({ grace: Joi.number().required() }),
    },
    {
      is: DISCOUNT_APPLICABILITY.DEPOSIT,
      then: Joi.object({
        discountType: Joi.string()
          .valid(...Object.values(DISCOUNT_TYPES))
          .required(),
        discountValue: Joi.any()
          .required()
          .when("discountType", {
            is: DISCOUNT_TYPES.PERCENTAGE,
            then: Joi.number().max(50),
            otherwise: Joi.number(),
          }),
      }),
    },
    {
      is: DISCOUNT_APPLICABILITY.INSTALLMENT,
      then: Joi.object({
        discountType: Joi.string()
          .valid(...Object.values(DISCOUNT_TYPES))
          .required(),
        discountValue: Joi.any()
          .required()
          .when("discountType", {
            is: DISCOUNT_TYPES.PERCENTAGE,
            then: Joi.number().max(50),
            otherwise: Joi.number(),
          }),
      }),
      otherwise: Joi.object({}),
    },
  ])
  .xor("flatId", "subFlatId")
  .unknown(false)
  .custom((value, helpers) => {
    const { startDate, endDate, paymentFrequency } = value;

    const timeDiffInMonths = Math.abs(
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth())
    );
    if (paymentFrequency) {
      if (
        timeDiffInMonths < PAYMENT_FREQUENCY_VALUES[paymentFrequency] ||
        timeDiffInMonths % PAYMENT_FREQUENCY_VALUES[paymentFrequency] !== 0
      ) {
        return helpers.error("date.difference.invalid", { paymentFrequency });
      }
    }

    if (value.isDiscountRequired) {
      switch (value.discountApplicability) {
        case DISCOUNT_APPLICABILITY.GRACE:
          if (timeDiffInMonths < value.grace) {
            return helpers.error("grace.discount.invalid");
          }
          break;
        case DISCOUNT_APPLICABILITY.DEPOSIT:
          if (
            value.discountType === DISCOUNT_TYPES.FIXED &&
            value.discountValue > value.securityDeposit
          ) {
            return helpers.error("deposit.discount.invalid");
          }
          break;

        case DISCOUNT_APPLICABILITY.INSTALLMENT:
          if (
            value.discountType === DISCOUNT_TYPES.FIXED &&
            value.discountValue > value.rentAmount
          ) {
            return helpers.error("rent.discount.invalid");
          }
          break;

        default:
          break;
      }
      value["discount"] = {
        discountApplicability: value.discountApplicability,
      };
      if (value.discountApplicability === DISCOUNT_APPLICABILITY.GRACE) {
        value["discount"]["grace"] = value.grace;
      } else {
        value["discount"]["discountType"] = value.discountType;
        value["discount"]["discountValue"] = value.discountValue;
      }
    }

    delete value.discountApplicability;
    delete value.grace;
    delete value.discountType;
    delete value.discountValue;
    delete value.paymentDetailsRequired;

    value.endDate.setHours(23, 59, 59, 999); //TODO: check the date when hosted on server

    if (!value.moveInDate) {
      value["moveInDate"] = value.startDate;
    }

    if (!value.moveOutDate) {
      value["moveOutDate"] = value.endDate;
    }
    return value;
  })
  .messages({
    "date.difference.invalid":
      "startDate and endDate does not satisfy time difference for {{#paymentFrequency}} paymentFrequency",
    "grace.discount.invalid": "grace cannot be greater than total lease period",
    "deposit.discount.invalid":
      "discountValue cannot be greater than securityDeposit",
    "rent.discount.invalid": "discountValue cannot be greater than rentAmount",
  });

/**
 * Schema object to get list of leases
 */
exports.getLeasesSchema = Joi.object({
  search: Joi.string(),
  status: Joi.string().valid(...Object.values(LEASE_STATUSES)),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  flatId: Joi.string().uuid({ version: "uuidv1" }),
  startDate: Joi.date(),
  endDate: Joi.date(),
  flatUsage: Joi.string().valid(...Object.values(FLAT_USAGE)),
  sortByExpiry: Joi.boolean(),
}).unknown(false);

/**
 * Joi Schema to get lease by leaseId
 */
exports.getLeaseByLeaseIdSchema = Joi.object({
  leaseId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.terminateLeaseSchema = Joi.object({
  leaseId: Joi.string().uuid({ version: "uuidv4" }).required(),
  comment: Joi.string(),
}).unknown(false);

/**
 * Schema to change status of a lease for admin
 */
exports.changeLeaseStatusForAdminSchema = Joi.object({
  leaseId: Joi.string().uuid({ version: "uuidv4" }).required(),
  status: Joi.string()
    .valid(...new Array(LEASE_STATUSES.CANCELLED, LEASE_STATUSES.ACTIVE))
    .required(),
});

/**
 * Schema object to update a draft lease
 */
exports.updateLeaseDraftSchema = Joi.object({
  startDate: Joi.date(),
  flatId: Joi.string().uuid({ version: "uuidv1" }),
  subFlatId: Joi.string().uuid({ version: "uuidv4" }),
  masterUserId: Joi.string().uuid({ version: "uuidv4" }),
  endDate: Joi.any().when("startDate", {
    is: Joi.exist(),
    then: Joi.date().greater(Joi.ref("startDate")),
    otherwise: Joi.date(),
  }),
  moveInDate: Joi.date(),
  moveOutDate: Joi.date(),
  paymentFrequency: Joi.string().valid(...Object.values(PAYMENT_FREQUENCIES)),
  securityDeposit: Joi.number(),
  currency: Joi.string(),
  paymentMode: Joi.string().valid(...Object.values(PAYMENT_MODES)),
  flatUsage: Joi.string().valid(...Object.values(FLAT_USAGE)),
  rentAmount: Joi.number(),
  activationFee: Joi.number(),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(),
    }).unknown(false)
  ),
  amenities: Joi.array().items(
    Joi.object({
      itemName: Joi.string().required(),
      quantity: Joi.number().required(),
      itemIds: Joi.array().items(Joi.string()),
      description: Joi.string(),
    })
  ),
  terms: Joi.array().items(Joi.string()),
  noticePeriod: Joi.number().max(10),
  description: Joi.string(),
  isDiscountRequired: Joi.boolean(),
  discountApplicability: Joi.string()
    .valid(...Object.values(DISCOUNT_APPLICABILITY))
    .when("isDiscountRequired", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
})
  .when(".discountApplicability", [
    {
      is: DISCOUNT_APPLICABILITY.GRACE,
      then: Joi.object({ grace: Joi.number().required() }),
    },
    {
      is: DISCOUNT_APPLICABILITY.DEPOSIT,
      then: Joi.object({
        discountType: Joi.string()
          .valid(...Object.values(DISCOUNT_TYPES))
          .required(),
        discountValue: Joi.any()
          .required()
          .when("discountType", {
            is: DISCOUNT_TYPES.PERCENTAGE,
            then: Joi.number().max(50),
            otherwise: Joi.number(),
          }),
      }),
    },
    {
      is: DISCOUNT_APPLICABILITY.INSTALLMENT,
      then: Joi.object({
        discountType: Joi.string()
          .valid(...Object.values(DISCOUNT_TYPES))
          .required(),
        discountValue: Joi.any()
          .required()
          .when("discountType", {
            is: DISCOUNT_TYPES.PERCENTAGE,
            then: Joi.number().max(50),
            otherwise: Joi.number(),
          }),
      }),
      otherwise: Joi.object({}),
    },
  ])
  .custom((value, helpers) => {
    const { startDate, endDate, paymentFrequency } = value;
    if (startDate && endDate && paymentFrequency) {
      const timeDiffInMonths = Math.abs(
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth())
      );
      if (
        timeDiffInMonths < PAYMENT_FREQUENCY_VALUES[paymentFrequency] ||
        timeDiffInMonths % PAYMENT_FREQUENCY_VALUES[paymentFrequency] !== 0
      ) {
        return helpers.error("date.difference.invalid", { paymentFrequency });
      }
    }
    if (value.isDiscountRequired) {
      switch (value.discountApplicability) {
        case DISCOUNT_APPLICABILITY.DEPOSIT:
          if (
            value.discountType === DISCOUNT_TYPES.FIXED &&
            value.discountValue > value.securityDeposit
          ) {
            return helpers.error("deposit.discount.invalid");
          }
          break;

        case DISCOUNT_APPLICABILITY.INSTALLMENT:
          if (
            value.discountType === DISCOUNT_TYPES.FIXED &&
            value.discountValue > value.rentAmount
          ) {
            return helpers.error("rent.discount.invalid");
          }
          break;

        default:
          break;
      }
      value["discount"] = {
        discountApplicability: value.discountApplicability,
      };
      if (value.discountApplicability === DISCOUNT_APPLICABILITY.GRACE) {
        value["discount"]["grace"] = value.grace;
      } else {
        value["discount"]["discountType"] = value.discountType;
        value["discount"]["discountValue"] = value.discountValue;
      }

      delete value.discountApplicability;
      delete value.grace;
      delete value.discountType;
      delete value.discountValue;
    } else {
      value["discount"] = {};
    }

    delete value.isDiscountRequired;

    return value;
  })
  .messages({
    "date.difference.invalid":
      "startDate and endDate does not satisfy time difference for {{#paymentFrequency}} paymentFrequency",
    "grace.discount.invalid": "grace cannot be greater than total lease period",
    "deposit.discount.invalid":
      "discountValue cannot be greater than securityDeposit",
    "rent.discount.invalid": "discountValue cannot be greater than rentAmount",
  });

exports.getLeasesExportsSchema = Joi.object({
  search: Joi.string(),
  status: Joi.string().valid(...Object.values(LEASE_STATUSES)),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  flatId: Joi.string().uuid({ version: "uuidv1" }),
  startDate: Joi.date(),
  endDate: Joi.date(),
  flatUsage: Joi.string().valid(...Object.values(FLAT_USAGE)),
}).unknown(false);

module.exports.getLeaseStatisticsSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
}).unknown(false);
