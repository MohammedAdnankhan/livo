const Joi = require("joi");
const {
  CONTRACT_STATUSES,
  GENDERS,
  COMPANY_TYPES,
  USER_ROLES,
  PAYMENT_FREQUENCIES,
  PAYMENT_MODES,
  FLAT_USAGE,
  DISCOUNT_APPLICABILITY,
  DISCOUNT_TYPES,
  PAYMENT_FREQUENCY_VALUES,
  USER_FILTERS,
} = require("../../config/constants");

exports.getTenantsForOwnerSchema = Joi.object({
  contractStatus: Joi.string()
    .valid(...Object.values(CONTRACT_STATUSES))
    .required(),
  buildingId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  flatId: Joi.string().uuid({ version: "uuidv1" }).optional(),
}).unknown(false);

exports.getTenantByIdForOwnerSchema = Joi.object({
  id: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

//TODO: remove
exports.getContractDetailsForOwnerSchema = Joi.object({
  id: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

/**
 * Schema to create a user from Admin panel
 */
exports.createMasterUserSchema = Joi.object({
  email: Joi.string().required(),
  countryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .required()
    .error(new Error("countryCode should consist of only digits")),
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .required()
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  name: Joi.string().min(2).required(),
  profilePicture: Joi.string().uri().optional(),
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
  alternateEmail: Joi.string().optional(),
  alternateCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .optional()
    .error(new Error("alternateCountryCode should consist of only digits")),
  alternateMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .optional()
    .error(
      new Error(
        "alternateMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  accountNumber: Joi.string().optional(),
  accountHolderName: Joi.string().optional(),
  bankName: Joi.string().optional(),
  swiftCode: Joi.string().optional(),
  iban: Joi.string().optional(),
  dateOfBirth: Joi.string()
    .regex(/^\d{4}[-/]\d{2}[-/]\d{2}$/)
    .error(new Error("dateOfBirth should be in valid date format"))
    .optional(),
  gender: Joi.string()
    .valid(...Object.values(GENDERS))
    .optional(),
  nationality: Joi.string().optional(),
  companyId: Joi.string().uuid({ version: "uuidv4" }).optional(),
  documentType: Joi.string(),
  documentId: Joi.string(),
})
  .with("alternateCountryCode", "alternateMobileNumber")
  .with("alternateMobileNumber", "alternateCountryCode")
  .unknown(false)
  .custom((value, _helpers) => {
    value.alternateContact = {
      email: value.alternateEmail ? value.alternateEmail : null,
      countryCode: value.alternateCountryCode
        ? value.alternateCountryCode
        : null,
      mobileNumber: value.alternateMobileNumber
        ? value.alternateMobileNumber
        : null,
    };
    delete value.alternateEmail;
    delete value.alternateCountryCode;
    delete value.alternateMobileNumber;

    value.isCompany = false;

    return value;
  });

/**
 * Schema to create a company from Admin Panel
 */
exports.createCompanySchema = Joi.object({
  email: Joi.string().required(),
  companyCityId: Joi.string().uuid({ version: "uuidv4" }).optional(),
  companyCountry: Joi.string().optional(),
  countryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .required()
    .error(new Error("countryCode should consist of only digits")),
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .required()
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  name: Joi.string().min(2).required(),
  profilePicture: Joi.string().uri().optional(),
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
  alternateEmail: Joi.string().optional(),
  alternateCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .optional()
    .error(new Error("alternateCountryCode should consist of only digits")),
  alternateMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .optional()
    .error(
      new Error(
        "alternateMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  accountNumber: Joi.string().optional(),
  accountHolderName: Joi.string().optional(),
  bankName: Joi.string().optional(),
  swiftCode: Joi.string().optional(),
  iban: Joi.string().optional(),
  companyType: Joi.string()
    .valid(...Object.values(COMPANY_TYPES))
    .optional(),
  licenseNumber: Joi.string().optional(),
  tradeLicense: Joi.string().optional(),
  pocEmail: Joi.string().optional(),
  pocName: Joi.string().optional(),
  pocCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .optional()
    .error(new Error("pocCountryCode should consist of only digits")),
  pocMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .optional()
    .error(
      new Error(
        "pocMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
})
  .with("alternateCountryCode", "alternateMobileNumber")
  .with("alternateMobileNumber", "alternateCountryCode")
  .with("pocCountryCode", "pocMobileNumber")
  .with("pocMobileNumber", "pocCountryCode")
  .custom((value, _helpers) => {
    value.alternateContact = {
      email: value.alternateEmail ? value.alternateEmail : null,
      countryCode: value.alternateCountryCode
        ? value.alternateCountryCode
        : null,
      mobileNumber: value.alternateMobileNumber
        ? value.alternateMobileNumber
        : null,
    };
    delete value.alternateEmail;
    delete value.alternateCountryCode;
    delete value.alternateMobileNumber;

    value.companyPoc = {
      name: value.pocName ? value.pocName : null,
      email: value.pocEmail ? value.pocEmail : null,
      countryCode: value.pocCountryCode ? value.pocCountryCode : null,
      mobileNumber: value.pocMobileNumber ? value.pocMobileNumber : null,
    };
    delete value.pocEmail;
    delete value.pocCountryCode;
    delete value.pocMobileNumber;
    delete value.pocName;

    value.isCompany = true;

    return value;
  });

/**
 * Schema to get Company By Company Id
 */
exports.getCompanyByCompanyIdSchema = Joi.object({
  companyId: Joi.string().uuid({ version: "uuidv4" }).required(),
}).unknown(false);

/**
 * Schema to update the details of a company
 */
exports.updateCompanySchema = Joi.object({
  email: Joi.string(),
  countryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("countryCode should consist of only digits")),
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  companyCityId: Joi.string().uuid({ version: "uuidv4" }),
  companyCountry: Joi.string(),
  name: Joi.string().min(2),
  profilePicture: Joi.string().uri(),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string().optional(), //Used By FE in ANT-D
    }).unknown(false)
  ),
  alternateEmail: Joi.string().optional(),
  alternateCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .optional()
    .error(new Error("alternateCountryCode should consist of only digits")),
  alternateMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .optional()
    .error(
      new Error(
        "alternateMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  accountNumber: Joi.string(),
  accountHolderName: Joi.string(),
  bankName: Joi.string(),
  swiftCode: Joi.string(),
  iban: Joi.string(),
  companyType: Joi.string().valid(...Object.values(COMPANY_TYPES)),
  licenseNumber: Joi.string(),
  tradeLicense: Joi.string(),
  pocEmail: Joi.string().optional(),
  pocName: Joi.string().optional(),
  pocCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .optional()
    .error(new Error("pocCountryCode should consist of only digits")),
  pocMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .optional()
    .error(
      new Error(
        "pocMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
})
  .with("alternateCountryCode", "alternateMobileNumber")
  .with("alternateMobileNumber", "alternateCountryCode")
  .with("pocCountryCode", "pocMobileNumber")
  .with("pocMobileNumber", "pocCountryCode")
  .custom((value, _helpers) => {
    const bankDetails = {};
    if (value.accountNumber) {
      bankDetails["accountNumber"] = value.accountNumber;
    }

    if (value.accountHolderName) {
      bankDetails["accountHolderName"] = value.accountHolderName;
    }

    if (value.bankName) {
      bankDetails["bankName"] = value.bankName;
    }

    if (value.swiftCode) {
      bankDetails["swiftCode"] = value.swiftCode;
    }

    if (value.iban) {
      bankDetails["iban"] = value.iban;
    }
    value.bankDetails = bankDetails;

    delete value.accountNumber;
    delete value.accountHolderName;
    delete value.bankName;
    delete value.swiftCode;
    delete value.iban;

    const alternateContact = {};
    if (value["alternateEmail"]) {
      alternateContact["email"] = value["alternateEmail"];
    }

    if (value["alternateCountryCode"]) {
      alternateContact["countryCode"] = value["alternateCountryCode"];
    }

    if (value["alternateMobileNumber"]) {
      alternateContact["mobileNumber"] = value["alternateMobileNumber"];
    }

    value.alternateContact = alternateContact;

    delete value["alternateEmail"];
    delete value["alternateCountryCode"];
    delete value["alternateMobileNumber"];

    const companyPoc = {};
    if (value["pocEmail"]) {
      companyPoc["email"] = value["pocEmail"];
    }

    if (value["pocCountryCode"]) {
      companyPoc["countryCode"] = value["pocCountryCode"];
    }

    if (value["pocMobileNumber"]) {
      companyPoc["mobileNumber"] = value["pocMobileNumber"];
    }

    if (value["pocName"]) {
      companyPoc["name"] = value["pocName"];
    }

    value.companyPoc = companyPoc;

    delete value["pocEmail"];
    delete value["pocCountryCode"];
    delete value["pocMobileNumber"];
    delete value["pocName"];

    return value;
  });

/**
 * Schema to get list of companies
 */
exports.getCompaniesSchema = Joi.object({
  search: Joi.string().optional(),
  companyType: Joi.string().valid(...Object.values(COMPANY_TYPES)),
  companyCityId: Joi.string().uuid({ version: "uuidv4" }),
  companyCountry: Joi.string(),
}).unknown(false);

/**
 * Schema to get list of users
 */
exports.getMasterUsersSchemaForAdmin = Joi.object({
  userType: Joi.string()
    .valid(...Object.values(USER_FILTERS))
    .optional(),
  search: Joi.string().optional(),
  buildingId: Joi.string().uuid({ version: "uuidv1" }).optional(),
  nationality: Joi.string(),
  gender: Joi.string().valid(...Object.values(GENDERS)),
}).unknown(false);

/**
 * Schema to get user by Master User Id
 */
exports.getUserByMasterUserIdSchema = Joi.object({
  masterUserId: Joi.string().uuid({ version: "uuidv4" }).required(),
});

/**
 * Schema object for updating a Master User
 */
exports.updateMasterUserSchema = Joi.object({
  email: Joi.string(),
  countryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("countryCode should consist of only digits")),
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  name: Joi.string().min(2),
  profilePicture: Joi.string().uri().allow(null),
  documents: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uid: Joi.string(), //Used By FE in ANT-D
    }).unknown(false)
  ),
  alternateEmail: Joi.string(),
  alternateCountryCode: Joi.string()
    .regex(/^[0-9]+$/)
    .error(new Error("alternateCountryCode should consist of only digits")),
  alternateMobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .error(
      new Error(
        "alternateMobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  accountNumber: Joi.string(),
  accountHolderName: Joi.string(),
  bankName: Joi.string(),
  swiftCode: Joi.string(),
  iban: Joi.string(),
  dateOfBirth: Joi.string()
    .regex(/^\d{4}[-/]\d{2}[-/]\d{2}$/)
    .error(new Error("dateOfBirth should be in valid date format")),
  gender: Joi.string().valid(...Object.values(GENDERS)),
  nationality: Joi.string(),
  companyId: Joi.string().uuid({ version: "uuidv4" }),
  documentType: Joi.string(),
  documentId: Joi.string(),
})
  .with("alternateCountryCode", "alternateMobileNumber")
  .with("alternateMobileNumber", "alternateCountryCode")
  .with("countryCode", "mobileNumber")
  .with("mobileNumber", "countryCode")
  .unknown(false)
  .custom((value, _helpers) => {
    const bankDetails = {};
    if (value.accountNumber) {
      bankDetails["accountNumber"] = value.accountNumber;
    }

    if (value.accountHolderName) {
      bankDetails["accountHolderName"] = value.accountHolderName;
    }

    if (value.bankName) {
      bankDetails["bankName"] = value.bankName;
    }

    if (value.swiftCode) {
      bankDetails["swiftCode"] = value.swiftCode;
    }

    if (value.iban) {
      bankDetails["iban"] = value.iban;
    }
    value.bankDetails = bankDetails;

    delete value.accountNumber;
    delete value.accountHolderName;
    delete value.bankName;
    delete value.swiftCode;
    delete value.iban;

    const alternateContact = {};
    if (value["alternateEmail"]) {
      alternateContact["email"] = value["alternateEmail"];
    }

    if (value["alternateCountryCode"]) {
      alternateContact["countryCode"] = value["alternateCountryCode"];
    }

    if (value["alternateMobileNumber"]) {
      alternateContact["mobileNumber"] = value["alternateMobileNumber"];
    }

    value.alternateContact = alternateContact;

    delete value["alternateEmail"];
    delete value["alternateCountryCode"];
    delete value["alternateMobileNumber"];

    return value;
  });

exports.getMasterUsersSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  userType: Joi.string()
    .valid(...Object.values(USER_ROLES))
    .optional(),
  search: Joi.string().optional(),
});

/**
 * Schema object to create a draft lease
 */
exports.approveSignUpSchema = Joi.object({
  requestedFlat: Joi.string().uuid({ version: "uuidv1" }),
  startDate: Joi.date().min(new Date().setHours(0, 0, 0, 0)).required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  moveInDate: Joi.date(),
  moveOutDate: Joi.date(),
  paymentFrequency: Joi.string()
    .valid(...Object.values(PAYMENT_FREQUENCIES))
    .required(),
  securityDeposit: Joi.number().required(),
  currency: Joi.string().required(),
  paymentMode: Joi.string()
    .valid(...Object.values(PAYMENT_MODES))
    .required(),
  flatUsage: Joi.string()
    .valid(...Object.values(FLAT_USAGE))
    .required(),
  rentAmount: Joi.number().required(),
  activationFee: Joi.number(),
  isDiscountRequired: Joi.boolean().required(),
  discountApplicability: Joi.string()
    .valid(...Object.values(DISCOUNT_APPLICABILITY))
    .when("isDiscountRequired", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  noticePeriod: Joi.number().max(10),
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
  .unknown(false)
  .custom((value, helpers) => {
    const { startDate, endDate, paymentFrequency } = value;

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
          return helpers.error("discount.invalid");
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
    "discount.invalid": "discountValue is invalid",
  });
