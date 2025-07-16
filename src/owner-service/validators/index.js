const Joi = require("joi");
const { GENDERS } = require("../../config/constants");

exports.ownerLoginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().min(5).max(20).required(),
});

exports.resetPasswordOtpSchema = Joi.object({
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .required()
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
}).unknown(false);

exports.resetPasswordSchema = Joi.object({
  mobileNumber: Joi.string()
    .regex(/^[0-9]{12}$/)
    .required()
    .error(
      new Error(
        "mobileNumber should consist of 12 digits only including Country Code"
      )
    ),
  password: Joi.string().min(5).max(20).required(),
  otp: Joi.number().required(),
}).unknown(false);

exports.ownerUpdateSchema = Joi.object({
  name: Joi.string(),
  profilePicture: Joi.string().uri(),
  gender: Joi.string().valid(...Object.values(GENDERS)),
  dateOfBirth: Joi.string()
    .pattern(/^\d{4}\/[0-1][0-9]\/[0-3][0-9]$/)
    .message("Date must be in the format YYYY/MM/DD"),
  documents: Joi.array().items(Joi.string()),
  email: Joi.string(),
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

  nationality: Joi.string(),
  documentType: Joi.string(),
  documentId: Joi.string(),
  accountNumber: Joi.string(),
  accountHolderName: Joi.string(),
  bankName: Joi.string(),
  swiftCode: Joi.string(),
})
  .with("alternateCountryCode", "alternateMobileNumber")
  .with("alternateMobileNumber", "alternateCountryCode")

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

    delete value.accountNumber;
    delete value.accountHolderName;
    delete value.bankName;
    delete value.swiftCode;
    value["bankDetails"] = bankDetails;
    return value;
  });
