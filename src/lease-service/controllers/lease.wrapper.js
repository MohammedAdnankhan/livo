const moment = require("moment-timezone");
const Lease = require("../models/Lease");
const { LEASE_STATUSES } = require("../../config/constants");
const LeaseStatus = require("../models/LeaseStatus");

/**
 * @async
 * @param {import("../types").IPreApprovalDetailForLease} data
 * @param {string} flatId
 * @param {string} masterUserId
 * @param {any | undefined} transaction
 */
module.exports.createLeaseForHomeTherapy = async (
  data,
  flatId,
  masterUserId,
  transaction = null
) => {
  const leaseData = {
    flatId,
    masterUserId,
    startDate: moment().endOf("day").toDate(),
    endDate: moment().add(data.approvalDuration, "year").endOf("day").toDate(),
    flatUsage: data.flatUsage,
    securityDeposit: data.securityDeposit,
    activationFee: data.activationFee,
    paymentFrequency: data.paymentFrequency,
    paymentMode: data.paymentMode,
    currency: data.currency,
    noticePeriod: data.noticePeriod,
    rentAmount: data.rentAmount,
  };
  leaseData["moveInDate"] = leaseData.startDate;
  leaseData["moveOutDate"] = leaseData.endDate;

  const lease = await Lease.create(leaseData, { transaction });
  const leaseStatuses = [
    {
      leaseId: lease.id,
      status: LEASE_STATUSES.DRAFT,
    },
    {
      leaseId: lease.id,
      status: LEASE_STATUSES.ACTIVE,
    },
  ];

  for (const status of leaseStatuses) {
    await LeaseStatus.create(status, { transaction });
  } //Intentional Loop instead of Bulk Create
  return null;
};

module.exports.createActiveLeaseForTenantSignup = async (
  leaseData,
  masterUserId,
  transaction = null
) => {
  leaseData.masterUserId = masterUserId;
  const lease = await Lease.create(leaseData, { transaction });
  const leaseStatuses = [
    {
      leaseId: lease.id,
      status: LEASE_STATUSES.DRAFT,
    },
    {
      leaseId: lease.id,
      status: LEASE_STATUSES.ACTIVE,
    },
  ];

  for (const status of leaseStatuses) {
    await LeaseStatus.create(status, { transaction });
  }
  return null;
};
