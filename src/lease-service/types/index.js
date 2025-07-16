/**
 * @typedef {object} ICreateLeaseDraft
 * @property {string | undefined} flatId
 * @property {string | undefined} ownerId
 * @property {string | undefined} subFlatId
 * @property {string} masterUserId
 * @property {Date} startDate
 * @property {Date} endDate
 * @property {Date | undefined} moveInDate
 * @property {Date | undefined} moveOutDate
 * @property {string} paymentFrequency
 * @property {number} securityDeposit
 * @property {string} currency
 * @property {string} paymentMode
 * @property {string} flatUsage
 * @property {number} rentAmount
 * @property {number} activationFee
 * @property {import("../../utils/types").IDocument[] | [] | undefined} documents
 * @property {boolean} isDiscountRequired
 * @property {ILeaseDiscount | undefined} discount
 * @property {ILeaseAmenity[] | [] | undefined} amenities
 * @property {string[] | [] | undefined} terms
 * @property {number | undefined} noticePeriod
 * @property {string | undefined} description
 */

/**
 * @typedef {object} ILeaseDiscount
 * @property {string} discountApplicability
 * @property {number | undefined} grace
 * @property {"Fixed" | "Percentage" | undefined} discountType
 * @property {number | undefined} discountValue
 */

/**
 * @typedef {object} ILeaseAmenity
 * @property {string} itemName
 * @property {number} quantity
 * @property {string[] | [] | undefined} itemIds[]
 * @property {string | undefined} description
 */

/**
 * @typedef {object} IGetLeasesForAdmin
 * @property {string} propertyId
 * @property {string | undefined} search
 * @property {string | undefined} status
 * @property {string | undefined} flatUsage
 * @property {string | undefined} flatId
 * @property {Date | undefined} startDate
 * @property {Date | undefined} endDate
 * @property {string | undefined} buildingId
 */

/**
 * @typedef {object} IChangeLeaseStatusForAdmin
 * @property {string} leaseId - Id of the selected lease
 * @property {"Cancelled" | "Active"} status - Status to change lease to
 * @property {string} propertyId - Property Id of the Admin
 */

/**
 * @typedef {object} IUpdateLeaseDraft
 * @property {Date | undefined} startDate
 * @property {Date | undefined} endDate
 * @property {Date | undefined} moveInDate
 * @property {Date | undefined} moveOutDate
 * @property {string | undefined} paymentFrequency
 * @property {number | undefined} securityDeposit
 * @property {string | undefined} currency
 * @property {string | undefined} paymentMode
 * @property {string | undefined} flatUsage
 * @property {number | undefined} rentAmount
 * @property {number | undefined} activationFee
 * @property {import("../../utils/types").IDocument[] | [] | undefined} documents
 * @property {boolean | undefined} isDiscountRequired
 * @property {ILeaseDiscount | undefined} discount
 * @property {ILeaseAmenity[] | [] | undefined} amenities
 * @property {string[] | [] | undefined} terms
 * @property {number | undefined} noticePeriod
 * @property {string | undefined} description
 */

/**
 * @typedef {object} IGetLease
 * @property {string} leaseId - Id of the lease
 * @property {string} propertyId - Property Id of the admin
 */

/**
 * @typedef {object} IPreApprovalDetailForLease
 * @property {string} flatUsage
 * @property {string} approvalDuration
 * @property {string} securityDeposit
 * @property {string} activationFee
 * @property {string} paymentFrequency
 * @property {string} paymentMode
 * @property {string} currency
 * @property {string} noticePeriod
 * @property {string} rentAmount
 */

module.exports = {};
