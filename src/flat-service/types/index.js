/**
 * Represents a Flat object.
 * @typedef {Object} ICreateFlat
 * @property {string} name_en - The name of the flat in English.
 * @property {string} buildingId - The unique identifier of the building.
 * @property {string[]} amenities - Amenities in a flat.
 * @property {string | undefined} floor - The floor of the flat.
 * @property {string} flatType - The type of the flat.
 * @property {number | undefined} size - The size of the flat.
 * @property {string | undefined} ownerId - The unique identifier of the owner.
 * @property {string | undefined} unitId - The unit identifier of the flat.
 * @property {import("../../utils/types").IDocument[] | undefined} documents - An array of documents associated with the flat.
 * @property {string[] | undefined} images - An array of image URLs associated with the flat.
 * @property {Object} flatInformation - Information about the flat.
 * @property {number} flatInformation.bedroom - The number of bedrooms in the flat.
 * @property {number} flatInformation.bathroom - The number of bathrooms in the flat.
 * @property {Object} flatInformation.primaryContact - Information about the primary contact.
 * @property {string} flatInformation.primaryContact.name - The name of the primary contact.
 * @property {string} flatInformation.primaryContact.countryCode - The country code of the primary contact.
 * @property {string} flatInformation.primaryContact.mobileNumber - The mobile number of the primary contact.
 * @property {string | null} flatInformation.primaryContact.email - The email address of the primary contact.
 * @property {string} flatInformation.furnishing - The furnishing type of the flat.
 * @property {string} flatInformation.parkingLots - Parking lots alloted to the flat.
 * @property {string} flatInformation.accessCards - Access Cards available in the unit.
 * @property {Object} flatInformation.poaDetails - Information about the Power of Attorney holder.
 * @property {string} flatInformation.poaDetails.name - The name of the Power of Attorney holder.
 * @property {string} flatInformation.poaDetails.countryCode - The country code of the Power of Attorney holder.
 * @property {string} flatInformation.poaDetails.mobileNumber - The mobile number of the Power of Attorney holder.
 * @property {string | null} flatInformation.poaDetails.email - The email address of the Power of Attorney holder.
 */

/**
 * Represents a Flat object for update.
 * @typedef {Object} IUpdateFlat
 * @property {string | undefined} name_en - The name of the flat in English.
 * @property {string | undefined} buildingId - The unique identifier of the building.
 * @property {string[] | [] | undefined} amenities - Amenities in a flat.
 * @property {string | undefined} floor - The floor of the flat.
 * @property {string | undefined} flatType - The type of the flat.
 * @property {number | undefined} size - The size of the flat.
 * @property {string | undefined} ownerId - The unique identifier of the owner.
 * @property {string | undefined} unitId - The unit identifier of the flat.
 * @property {import("../../utils/types").IDocument[] | [] | undefined} documents - An array of documents associated with the flat.
 * @property {string[] | undefined} images - An array of image URLs associated with the flat.
 * @property {IFlatInfo | {}} flatInformation - Information about the flat.
 * @property {string | undefined} poaName - The name of the Power of Attorney holder.
 * @property {string | undefined} poaCountryCode - The country code of the Power of Attorney holder.
 * @property {string | undefined} poaMobileNumber - The mobile number of the Power of Attorney holder.
 * @property {string | undefined} poaEmail - The email address of the Power of Attorney holder.
 * @property {string | undefined} contactName - The name of the primary contact.
 * @property {string | undefined} contactCountryCode - The country code of the primary contact.
 * @property {string | undefined} contactMobileNumber - The mobile number of the primary contact.
 * @property {string | undefined} contactEmail - The email address of the primary contact.
 */

/**
 * @typedef IFlatInfo
 * @property {number | undefined} flatInformation.bedroom - The number of bedrooms in the flat.
 * @property {number | undefined} flatInformation.bathroom - The number of bathrooms in the flat.
 * @property {string | undefined} flatInformation.furnishing - The furnishing type of the flat.
 * @property {string | undefined} flatInformation.parkingLots - Parking lots alloted to the flat.
 * @property {string | undefined} flatInformation.accessCards - Access Cards available in the unit.
 */

module.exports = {};
