const Joi = require("joi");
const {
  FLAT_FURNISHINGS,
  RENTAL_TYPES,
  FLAT_TYPES,
  CONTRACT_STATUSES,
  LEASE_RENTAL_TYPES,
} = require("../../config/constants");

exports.createSubFlatsSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).required(),
  subFlats: Joi.array()
    .items(
      Joi.object({
        name_en: Joi.string().required(),
        name_ar: Joi.string().default(Joi.x("{{name_en}}_ar")),
        size: Joi.number().optional(),
        documents: Joi.array()
          .items(
            Joi.object({
              name: Joi.string().required(),
              type: Joi.string().required(),
              url: Joi.string().uri().required(),
              uid: Joi.string().optional(), //Used By FE in ANT-D
            }).unknown(false)
          )
          .optional(),
        furnishing: Joi.string()
          .valid(...Object.values(FLAT_FURNISHINGS))
          .optional(),
        description: Joi.string().optional(),
        rentalType: Joi.string()
          .valid(...Object.values(RENTAL_TYPES))
          .optional(),
        images: Joi.array().items(Joi.string().uri()).optional(),
      }).unknown(false)
    )
    .required()
    .min(1),
});

exports.updateSubFlatSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  name_en: Joi.string().optional(),
  name_ar: Joi.string().default(Joi.x("{{name_en}}_ar")),
  size: Joi.string().optional(),
  furnishing: Joi.string()
    .optional()
    .valid(...Object.values(FLAT_FURNISHINGS)),
  rentalType: Joi.string()
    .valid(...Object.values(RENTAL_TYPES))
    .optional(),
  description: Joi.string().optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  documents: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        url: Joi.string().uri().required(),
        uid: Joi.string().optional(), //Used By FE in ANT-D
      }).unknown(false)
    )
    .optional(),
});

exports.getSubFlatsSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  buildingId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  status: Joi.string()
    .valid(...Object.values(CONTRACT_STATUSES))
    .optional(),
  flatType: Joi.string()
    .valid(...Object.values(FLAT_TYPES))
    .optional(),
  rentalType: Joi.string()
    .valid(...Object.values(RENTAL_TYPES))
    .optional(),
  flatIds: Joi.array().items(Joi.string().uuid({ version: "uuidv1" })),
  furnishing: Joi.string()
    .valid(...Object.values(FLAT_FURNISHINGS))
    .optional(),
  ownerIds: Joi.array().items(Joi.string().uuid({ version: "uuidv4" })),
  search: Joi.string(),
}).unknown(false);

exports.getSubFlatBySubFlatIdSchema = Joi.object({
  subFlatId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

exports.getSubFlatsForDropDownSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }),
});
