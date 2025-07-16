/**
 * @typedef {Object} ICreateMasterUserV2
 * @property {string} email - The user's email address.
 * @property {string} countryCode - The country code consisting of only digits.
 * @property {string} mobileNumber - The mobile number consisting of 12 digits, including the country code.
 * @property {string} name - The user's name (min 2 characters).
 * @property {string | undefined} profilePicture - The user's profile picture URI (optional).
 * @property {import("../../utils/types").IDocument[] | [] | undefined} documents - An array of user documents.
 * @property {Object | undefined} alternateContact - An alternate contact object.
 * @property {string | undefined} alternateContact.email - The alternate contact's email address (optional).
 * @property {string | undefined} alternateContact.countryCode - The alternate contact's country code consisting of only digits (optional).
 * @property {string | undefined} alternateContact.mobileNumber - The alternate contact's mobile number consisting of 12 digits, including the country code (optional).
 * @property {string | undefined} accountNumber - The user's account number (optional).
 * @property {string | undefined} accountHolderName - The name of the account holder (optional).
 * @property {string | undefined} bankName - The name of the bank (optional).
 * @property {string | undefined} swiftCode - The SWIFT code (optional).
 * @property {string | undefined} iban - The IBAN (optional).
 * @property {boolean} isCompany - Indicates whether the user is a company.
 * @property {string | undefined} companyType - Type of company.
 * @property {string | undefined} licenseNumber - License number of company.
 * @property {string | undefined} tradeLicense - Trade license of company.
 * @property {ICompanyPOC | undefined} companyPoc
 * @property {string | undefined} dateOfBirth
 * @property {string | undefined} gender
 * @property {string | undefined} nationality
 * @property {string | undefined} companyId
 * @property {string} propertyId
 */

/**
 * @typedef {Object} ICompanyPOC
 * @property {string} name - The company's Point of Contact name (optional).
 * @property {string} email - The company's Point of Contact email address (optional).
 * @property {string} countryCode - The company's Point of Contact country code consisting of only digits (optional).
 * @property {string} mobileNumber - The company's Point of Contact mobile number consisting of 12 digits, including the country code (optional).
 */

/**
 * @typedef {Object} IUpdateCompany
 * @property {string | undefined} email - The company's email address.
 * @property {string | undefined} countryCode - The country code consisting of only digits.
 * @property {string | undefined} mobileNumber - The mobile number consisting of 12 digits, including the country code.
 * @property {string | undefined} name - The user's name (min 2 characters).
 * @property {string | undefined} profilePicture - The user's profile picture URI (optional).
 * @property {import("../../utils/types").IDocument[] | [] | undefined} documents - An array of user documents.
 * @property {IBankDetail | undefined} bankDetails - The company's account details (optional).
 * @property {string | undefined} companyType - Type of company.
 * @property {string | undefined} licenseNumber - License number of company.
 * @property {string | undefined} tradeLicense - Trade license of company.
 * @property {ICompanyPOC | {}} companyPoc
 * @property {IAlternateContact | {}} alternateContact
 */

/**
 * @typedef {Object} ICountAndGetUsers
 * @property {string | undefined} userType
 * @property {string | undefined } search
 * @property {string | undefined} buildingId
 * @property {string} propertyId
 */

/**
 * @typedef {Object} IUpdateUser
 * @property {string | undefined} email - The user's email address.
 * @property {string | undefined} countryCode - The country code consisting of only digits.
 * @property {string | undefined} mobileNumber - The mobile number consisting of 12 digits, including the country code.
 * @property {string | undefined} name - The user's name (min 2 characters).
 * @property {string | undefined} profilePicture - The user's profile picture URI (optional).
 * @property {import("../../utils/types").IDocument[] | [] | undefined} documents - An array of user documents.
 * @property {IAlternateContact | {}} alternateContact
 * @property {IBankDetail | undefined} bankDetails - The user's account details (optional).
 * @property {string | undefined} dateOfBirth
 * @property {string | undefined} gender
 * @property {string | undefined} nationality
 * @property {string | undefined} companyId
 */

/**
 * @typedef {Object} IBankDetail
 * @property {string} accountNumber - The user's account number (optional).
 * @property {string} accountHolderName - The name of the account holder (optional).
 * @property {string} bankName - The name of the bank (optional).
 * @property {string} swiftCode - The SWIFT code (optional).
 * @property {string} iban - The IBAN (optional).
 */

/**
 * @typedef {object} IAlternateContact
 * @property {string | undefined | null} email
 * @property {string | undefined | null} countryCode
 * @property {string | undefined | null} mobileNumber
 */

module.exports = {};
