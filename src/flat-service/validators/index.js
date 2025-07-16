const Joi = require("joi");
const {
  CURRENCY,
  FLAT_TYPES,
  FLAT_FURNISHINGS,
  CONTRACT_STATUSES,
  LEASE_TYPES,
  LEASE_RENTAL_TYPES,
} = require("../../config/constants");

exports.mapOwnerToFlatSchema = Joi.object({
  ownerId: Joi.string().uuid({ version: "uuidv4" }).required(),
  flatId: Joi.string().uuid({ version: "uuidv1" }).required(),
  purchaseDate: Joi.date().max("now").iso().optional(),
  purchaseCurrency: Joi.string()
    .valid(...Object.values(CURRENCY))
    .optional(),
  purchasePrice: Joi.number().optional(),
}).unknown(false);

/**
 * Schema to get flat by Flat Id
 */
exports.getFlatByFlatIdSchema = Joi.object({
  flatId: Joi.string().uuid({ version: "uuidv1" }),
}).unknown(false);

/**
 * Schema object for creating a flat
 */
exports.createFlatSchema = Joi.object({
  name_en: Joi.string().required(),
  name_ar: Joi.string().default(Joi.x("{{name_en}}_ar")),
  buildingId: Joi.string().uuid({ version: "uuidv1" }).required(),
  floor: Joi.string(),
  flatType: Joi.string()
    .valid(...Object.values(FLAT_TYPES))
    .required(),
  size: Joi.number(),
  leaseType: Joi.string().valid(...Object.values(LEASE_TYPES)),
  rentalType: Joi.string().valid(...Object.values(LEASE_RENTAL_TYPES)),
  amenities: Joi.array().items(Joi.string()),
  furnishing: Joi.string().valid(...Object.values(FLAT_FURNISHINGS)),
  // purchaseCurrency: Joi.string().valid(...Object.values(CURRENCY)),
  // purchasePrice: Joi.string(),
  // purchaseDate: Joi.date().iso(),
  ownerId: Joi.string().uuid({ version: "uuidv4" }),
  unitId: Joi.string(),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(), //Used By FE in ANT-D
    }).unknown(false)
  ),
  images: Joi.array().items(Joi.string().uri()),
  bedroom: Joi.number(),
  bathroom: Joi.number(),
  contactEmail: Joi.string(),
  contactName: Joi.string(),
  contactCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("contactCountryCode should consist of only digits")),
  contactMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "contactMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  poaName: Joi.string(),
  poaEmail: Joi.string(),
  poaCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("contactCountryCode should consist of only digits")),
  poaMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "contactMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  parkingLots: Joi.array().items(Joi.string()),
  accessCards: Joi.array().items(Joi.string()),
  description: Joi.string(),
})
  .with("contactCountryCode", "contactMobileNumber")
  .with("contactMobileNumber", "contactCountryCode")
  .with("poaCountryCode", "poaMobileNumber")
  .with("poaMobileNumber", "poaCountryCode")
  .unknown(false)
  .custom((value, _helpers) => {
    value.flatInformation = {
      bedroom: value.bedroom ? value.bedroom : null,
      bathroom: value.bathroom ? value.bathroom : null,
      primaryContact: {
        name: value.contactName ? value.contactName : null,
        countryCode: value.contactCountryCode ? value.contactCountryCode : null,
        mobileNumber: value.contactMobileNumber
          ? value.contactMobileNumber
          : null,
        email: value.contactEmail ? value.contactEmail : null,
      },
      furnishing: value.furnishing ? value.furnishing : null,
      // purchaseCurrency: value.purchaseCurrency ? value.purchaseCurrency : null,
      // purchasePrice: value.purchasePrice ? value.purchasePrice : null,
      // purchaseDate: value.purchaseDate ? value.purchaseDate : null,
      poaDetails: {
        name: value.poaName ? value.poaName : null,
        countryCode: value.poaCountryCode ? value.poaCountryCode : null,
        mobileNumber: value.poaMobileNumber ? value.poaMobileNumber : null,
        email: value.poaEmail ? value.poaEmail : null,
      },
      parkingLots: value.parkingLots ? value.parkingLots : null,
      accessCards: value.accessCards ? value.accessCards : null,
      description: value.description ? value.description : null,
      leaseType: value.leaseType ? value.leaseType : null,
      rentalType: value.rentalType ? value.rentalType : null,
    };
    delete value.bedroom;
    delete value.bathroom;
    delete value.contactName;
    delete value.contactCountryCode;
    delete value.contactMobileNumber;
    delete value.contactEmail;
    delete value.furnishing;
    // delete value.purchaseCurrency;
    // delete value.purchasePrice;
    // delete value.purchaseDate;
    delete value.poaName;
    delete value.poaCountryCode;
    delete value.poaMobileNumber;
    delete value.poaEmail;
    delete value.description;
    delete value.parkingLots;
    delete value.accessCards;

    return value;
  });

/**
 * Schema object for updating a flat
 */
exports.updateFlatSchema = Joi.object({
  name_en: Joi.string(),
  name_ar: Joi.string().default(Joi.x("{{name_en}}_ar")),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  floor: Joi.string(),
  flatType: Joi.string().valid(...Object.values(FLAT_TYPES)),
  size: Joi.number(),
  amenities: Joi.array().items(Joi.string()),
  furnishing: Joi.string().valid(...Object.values(FLAT_FURNISHINGS)),
  ownerId: Joi.string().uuid({ version: "uuidv4" }),
  unitId: Joi.string(),
  leaseType: Joi.string().valid(...Object.values(LEASE_TYPES)),
  rentalType: Joi.string().valid(...Object.values(LEASE_RENTAL_TYPES)),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(), //Used By FE in ANT-D
    }).unknown(false)
  ),
  images: Joi.array().items(Joi.string().uri()),
  bedroom: Joi.number(),
  bathroom: Joi.number(),
  contactEmail: Joi.string(),
  contactName: Joi.string(),
  contactCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("contactCountryCode should consist of only digits")),
  contactMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "contactMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  poaName: Joi.string(),
  poaEmail: Joi.string(),
  poaCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("contactCountryCode should consist of only digits")),
  poaMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "contactMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  parkingLots: Joi.array().items(Joi.string()),
  accessCards: Joi.array().items(Joi.string()),
  description: Joi.string(),
})
  .with("contactCountryCode", "contactMobileNumber")
  .with("contactMobileNumber", "contactCountryCode")
  .with("poaCountryCode", "poaMobileNumber")
  .with("poaMobileNumber", "poaCountryCode")
  .unknown(false)
  .custom((value, _helpers) => {
    const flatInformation = {};
    if (value.bedroom) {
      flatInformation["bedroom"] = value.bedroom;
    }
    if (value.bathroom) {
      flatInformation["bathroom"] = value.bathroom;
    }
    if (value.furnishing) {
      flatInformation["furnishing"] = value.furnishing;
    }
    if (value.parkingLots) {
      flatInformation["parkingLots"] = value.parkingLots;
    }
    if (value.accessCards) {
      flatInformation["accessCards"] = value.accessCards;
    }
    if (value.description) {
      flatInformation["description"] = value.description;
    }
    delete value.bedroom;
    delete value.bathroom;
    delete value.furnishing;
    delete value.description;
    delete value.parkingLots;
    delete value.accessCards;

    value.flatInformation = flatInformation;

    return value;
  });

exports.getFlatsSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  contractStatus: Joi.string()
    .valid(...Object.values(CONTRACT_STATUSES))
    .optional(),
  flatType: Joi.string()
    .valid(...Object.values(FLAT_TYPES))
    .optional(),
  search: Joi.string().optional(),
  rentalType: Joi.string()
    .valid(...Object.values(LEASE_RENTAL_TYPES))
    .optional(),
  flatIds: Joi.array().items(Joi.string().uuid({ version: "uuidv1" })),
  furnishing: Joi.string()
    .valid(...Object.values(FLAT_FURNISHINGS))
    .optional(),
  ownerIds: Joi.array().items(Joi.string().uuid({ version: "uuidv4" })),
});
