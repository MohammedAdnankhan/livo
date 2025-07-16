const Joi = require("joi");
const {
  PAYMENT_MODES,
  DISCOUNT_TYPES,
  INVOICE_FOR,
} = require("../../config/constants");

module.exports.addInvoiceSchema = Joi.object({
  masterUserId: Joi.string().uuid({ version: "uuidv4" }).required(),
  sendEmail: Joi.boolean().required(),
  userInfo: Joi.object({
    name: Joi.string().required(),
    countryCode: Joi.string().required(),
    mobileNumber: Joi.string().required(),
    email: Joi.string(),
    billingAddress: Joi.string().required(),
  }).required(),
  invoiceFor: Joi.string()
    .valid(...Object.values(INVOICE_FOR))
    .required(),
  invoiceDate: Joi.date().required(),
  products: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        amount: Joi.number().required(),
        rate: Joi.number().required(),
        description: Joi.string(),
        quantity: Joi.number().required(),
      }).unknown(false)
    )
    .min(1)
    .required(),
  paymentMode: Joi.string()
    .valid(...Object.values(PAYMENT_MODES))
    .required(),
  currency: Joi.string().required(),
  discountValue: Joi.number(),
  discountType: Joi.string().valid(...Object.values(DISCOUNT_TYPES)),
  taxValue: Joi.number(),
  totalAmount: Joi.number().required(),
  finalAmount: Joi.number().required(),
  netAmount: Joi.number().required(),
  subTotalAmount: Joi.number().required(),
  depositedAmount: Joi.number(),
  dueDate: Joi.date().required(),
  termsConditions: Joi.string(),
  tagIds: Joi.array().items(Joi.string().uuid({ version: "uuidv4" })),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(),
    }).unknown(false)
  ),
});

module.exports.getInvoicesSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  search: Joi.string(),
});

module.exports.getInvoiceDetailsSchema = Joi.object({
  invoiceId: Joi.string().uuid({ version: "uuidv4" }),
});

module.exports.updateInvoiceSchema = Joi.object({
  masterUserId: Joi.string().uuid({ version: "uuidv4" }),
  transactionId: Joi.string(),
  paidDate: Joi.date(),
  userInfo: Joi.object({
    name: Joi.string(),
    countryCode: Joi.string(),
    mobileNumber: Joi.string(),
    email: Joi.string(),
    billingAddress: Joi.string(),
  }),
  sendEmail: Joi.boolean().required(),
  invoiceDate: Joi.date(),
  products: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        amount: Joi.number().required(),
        rate: Joi.number().required(),
        description: Joi.string(),
        quantity: Joi.number().required(),
      }).unknown(false)
    )
    .min(1),
  paymentMode: Joi.string().valid(...Object.values(PAYMENT_MODES)),
  currency: Joi.string(),
  discountValue: Joi.number(),
  discountType: Joi.string().valid(...Object.values(DISCOUNT_TYPES)),
  taxValue: Joi.number(),
  totalAmount: Joi.number(),
  finalAmount: Joi.number(),
  netAmount: Joi.number(),
  subTotalAmount: Joi.number(),
  amountReceived: Joi.number(),
  dueDate: Joi.date(),
  termsConditions: Joi.string(),
  tagIds: Joi.array().items(Joi.string().uuid({ version: "uuidv4" })),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(),
    }).unknown(false)
  ),
}).and("amountReceived", "paidDate", "transactionId");
