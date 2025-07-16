const ContractRenewal = require("../models/ContractRenewal");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const FlatContract = require("../models/FlatContract");
const ContractPayment = require("../models/ContractPayment");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const { AppError } = require("../../utils/errorHandler");
const moment = require("moment-timezone");
const {
  FLAT_USAGE,
  PAYMENT_FREQUENCIES,
  LANGUAGES,
  DISCOUNT_APPLICABILITY,
  PAYMENT_FREQUENCY_VALUES,
  RENEWAL_PERIOD_TYPE,
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
} = require("../../config/constants");
const db = require("../../database");
const { Op } = require("sequelize");
const { isValidDateTime } = require("../../utils/utility");
const Discount = require("../models/Discount");
const { createContractPayments } = require("./flatContract");
const eventEmitter = require("../../utils/eventEmitter");

const renewContractForUser = async ({
  periodType,
  timePeriod,
  mobileNumber,
  flatUsage,
  paymentFrequency,
  currency,
  userId,
}) => {
  const reference = "renewContractForUser";
  if (!periodType) {
    throw new AppError(
      reference,
      "Renewal period type is required",
      "custom",
      412
    );
  }
  if (!timePeriod) {
    throw new AppError(
      reference,
      "Renewal time period  is required",
      "custom",
      412
    );
  }

  if (flatUsage && !Object.values(FLAT_USAGE).includes(flatUsage)) {
    throw new AppError(reference, "Invalid flat usage type", "custom", 404);
  }
  if (periodType && !Object.values(RENEWAL_PERIOD_TYPE).includes(periodType)) {
    throw new AppError(reference, "Invalid Renewal Period type", "custom", 404);
  }
  if (
    paymentFrequency &&
    !Object.values(PAYMENT_FREQUENCIES).includes(paymentFrequency)
  ) {
    throw new AppError(
      reference,
      "Invalid payment frequency type",
      "custom",
      404
    );
  }
  const masterUser = await MasterUser.findOne({ where: { mobileNumber } });
  if (!masterUser) {
    throw new AppError(reference, "User not found", "custom", 404);
  }
  const flatContract = await FlatContract.findOne({
    where: {
      masterUserId: masterUser.id,
    },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: ContractPayment,
        as: "contractPayments",
        order: [["createdAt", "DESC"]],
        limit: 1,
      },
    ],
  });
  if (!flatContract) {
    throw new AppError(reference, "No previous contract found", "custom", 404);
  }

  if (flatContract.get("isExpired") === true) {
    throw new AppError(reference, "Contract is expired", "custom", 412);
  }

  const requestExists = await ContractRenewal.findOne({
    contractId: flatContract.id,
  });
  if (requestExists) {
    throw new AppError(
      reference,
      "Renewal request already in progress",
      "custom",
      409
    );
  }
  let renewalEndDate;

  const contractEndDate = flatContract.contractEndDate;
  if (periodType === RENEWAL_PERIOD_TYPE.MONTHS) {
    renewalEndDate = moment(contractEndDate)
      .add(parseInt(timePeriod), "months")
      .toDate();
  }
  if (periodType === RENEWAL_PERIOD_TYPE.YEARS) {
    renewalEndDate = moment(contractEndDate)
      .add(parseInt(timePeriod), "years")
      .toDate();
  }
  const renewContractData = {
    contractId: flatContract.id,
    flatUsage: flatUsage ? flatUsage : flatContract.flatUsage,
    contractEndDate: renewalEndDate,
    moveOutDate: renewalEndDate,
    paymentFrequency: paymentFrequency
      ? paymentFrequency
      : flatContract.paymentFrequency,
    currency: currency ? currency : flatContract.currency,
    rentAmount: flatContract.contractPayments[0].amount,
  };
  const renewalRequest = await ContractRenewal.create(renewContractData);

  eventEmitter.emit("admin_level_notification", {
    flatId: flatContract.flatId,
    actionType: ADMIN_ACTION_TYPES.LEASE_RENEWAL_REQUEST.key,
    sourceType: ADMIN_SOURCE_TYPES.LEASE,
    sourceId: renewalRequest.id,
    generatedBy: userId,
  });
  return null;
};

const renewContractForAdmin = async ({
  flatContractId,
  flatUsage,
  paymentFrequency,
  description,
  isDiscountRequired,
  applicableOn,
  discountValue,
  discountPeriod,
  rentAmount,
  contractEndDate,
  currency,
}) => {
  const reference = "renewContractForAdmin";

  if (!flatContractId) {
    throw new AppError(reference, "Contract Id is required", "custom", 412);
  }

  if (!contractEndDate) {
    throw new AppError(
      reference,
      "New Contract End Date is required",
      "custom",
      412
    );
  }

  if (flatUsage && !Object.values(FLAT_USAGE).includes(flatUsage)) {
    throw new AppError(
      reference,
      `Flat usage can only be ${Object.values(FLAT_USAGE).join(", ")}`,
      "custom",
      412
    );
  }
  if (
    paymentFrequency &&
    !Object.values(PAYMENT_FREQUENCIES).includes(paymentFrequency)
  ) {
    throw new AppError(
      reference,
      `Payment frequency can only be ${Object.values(PAYMENT_FREQUENCIES).join(
        ", "
      )}`,
      "custom",
      412
    );
  }

  if (isDiscountRequired && !applicableOn) {
    throw new AppError(
      reference,
      "Discount applicability is required when availing discount",
      "custom",
      412
    );
  }

  const flatContract = await FlatContract.findOne({
    where: {
      id: flatContractId,
    },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: ContractPayment,
        as: "contractPayments",
        order: [["createdAt", "DESC"]],
        limit: 1,
      },
    ],
  });
  if (!flatContract) {
    throw new AppError(reference, "No previous contract found", "custom", 404);
  }

  if (flatContract.get("isExpired") === true) {
    throw new AppError(
      reference,
      "Expired contracts cannot be renewed",
      "custom",
      412
    );
  }

  const requestExists = await ContractRenewal.findOne({
    where: { contractId: flatContract.id },
  });
  if (requestExists) {
    throw new AppError(
      reference,
      "Renewal request already in progress",
      "custom",
      409
    );
  }

  const renewContractData = {
    contractId: flatContract.id,
    flatUsage: flatUsage ? flatUsage : flatContract.flatUsage,
    paymentFrequency: paymentFrequency
      ? paymentFrequency
      : flatContract.paymentFrequency,
    discount: {
      amount: 0,
      grace: 0,
    },
    currency: currency ? currency : flatContract.currency,
    description: description ? description : null,
    discountPeriod: discountPeriod ? parseInt(discountPeriod) : 0,
    rentAmount: rentAmount
      ? rentAmount
      : flatContract.contractPayments[0].amount,
    isApproved: true,
  };

  if (contractEndDate) {
    const endDate = isValidDateTime(contractEndDate);
    if (endDate < new Date()) {
      throw new AppError(
        reference,
        "Contract End Date cannot be less than current Date",
        "custom",
        412
      );
    }

    //TODO: validate end date depending on payment frequency
    renewContractData["contractEndDate"] = endDate;
    renewContractData["moveOutDate"] = endDate;
  }

  if (isDiscountRequired && applicableOn) {
    if (!Object.values(DISCOUNT_APPLICABILITY).includes(applicableOn)) {
      throw new AppError(
        reference,
        `Discount applicability can have ${Object.values(
          DISCOUNT_APPLICABILITY
        ).join(", ")} values`,
        "custom",
        412
      );
    }
    if (applicableOn == DISCOUNT_APPLICABILITY.INSTALLMENT && discountValue) {
      renewContractData.discount.amount = parseFloat(discountValue);
    } else if (applicableOn == DISCOUNT_APPLICABILITY.GRACE && discountValue) {
      renewContractData.discount.grace = parseInt(discountValue);
    }
    renewContractData["isDiscountRequired"] = true;
    renewContractData["applicableOn"] = applicableOn;
  }

  await ContractRenewal.create(renewContractData);
  return null;
};

const getRenewalRequestsForAdmin = async (
  params,
  propertyId,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  const param = {};
  param[Op.and] = [{ newContractId: null }];
  if (params.search) {
    param[Op.and].push({
      [Op.or]: [
        {
          "$contract->resident.email$": { [Op.iLike]: `%${params.search}%` },
        },
        {
          "$contract->resident.mobileNumber$": {
            [Op.iLike]: `%${params.search}%`,
          },
        },
        {
          [`$contract->flat->building.name_${language}$`]: {
            [Op.iLike]: `%${params.search}%`,
          },
        },
        {
          [`$contract->flat.name_${language}$`]: {
            [Op.iLike]: `%${params.search}%`,
          },
        },
      ],
    });
  }

  const requests = await ContractRenewal.findAndCountAll({
    where: param,
    attributes: {
      include: [
        [db.sequelize.col(`"contract->resident".id`), "resident.id"],
        [db.sequelize.col(`"contract->resident".name`), "resident.name"],
        [db.sequelize.col(`"contract->resident".email`), "resident.email"],
        [
          db.sequelize.col(`"contract->resident".countryCode`),
          "resident.countryCode",
        ],
        [
          db.sequelize.col(`"contract->resident".mobileNumber`),
          "resident.mobileNumber",
        ],
        [db.sequelize.col(`"contract->flat".id`), "flat.id"],
        [db.sequelize.col(`"contract->flat".name_en`), "flat.name_en"],
        [db.sequelize.col(`"contract->flat".name_ar`), "flat.name_ar"],
        [db.sequelize.col(`"contract->flat->building".id`), "building.id"],
        [
          db.sequelize.col(`"contract->flat->building".name_en`),
          "building.name_en",
        ],
        [
          db.sequelize.col(`"contract->flat->building".name_ar`),
          "building.name_ar",
        ],
        [db.sequelize.col(`"contract".id`), "contract.id"],
        [db.sequelize.col(`"contract".contractId`), "contract.contractId"],
        [
          db.sequelize.col(`"contract".contractEndDate`),
          "contract.contractEndDate",
        ],
        [
          db.sequelize.col(`"contract".activationFee`),
          "contract.activationFee",
        ],
        [
          db.sequelize.col(`"contract".securityDeposit`),
          "contract.securityDeposit",
        ],
        [db.sequelize.col(`"contract".noticePeriod`), "contract.noticePeriod"],
        [db.sequelize.col(`"contract".paymentMode`), "contract.paymentMode"],
      ],
    },
    nest: true,
    raw: true,
    include: [
      {
        model: FlatContract,
        as: "contract",
        attributes: [],
        include: [
          {
            model: MasterUser,
            as: "resident",
            attributes: [],
          },
          {
            model: Flat,
            as: "flat",
            attributes: [],
            include: [
              {
                model: Building,
                as: "building",
                attributes: [],
                where: {
                  propertyId,
                },
              },
            ],
          },
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
    offset,
    limit,
  });

  requests.rows.forEach((request) => {
    request.contractStartDate = moment(request.contract.contractEndDate)
      .add(1, "day")
      .startOf("day")
      .toDate();
  });
  return requests;
};

const approveRequest = async (
  params,
  {
    flatUsage,
    paymentFrequency,
    description,
    isDiscountRequired,
    applicableOn,
    discountValue,
    discountPeriod,
    rentAmount,
    contractEndDate,
    currency,
  },
  propertyId
) => {
  const reference = `approveRequest`;

  if (flatUsage && !Object.values(FLAT_USAGE).includes(flatUsage)) {
    throw new AppError(
      reference,
      `Flat usage can only be ${Object.values(FLAT_USAGE).join(", ")}`,
      "custom",
      412
    );
  }

  if (
    paymentFrequency &&
    !Object.values(PAYMENT_FREQUENCIES).includes(paymentFrequency)
  ) {
    throw new AppError(
      reference,
      `Payment frequency can only be ${Object.values(PAYMENT_FREQUENCIES).join(
        ", "
      )}`,
      "custom",
      412
    );
  }

  const renewalRequest = await ContractRenewal.findOne({
    where: params,
    include: [
      {
        model: FlatContract,
        as: "contract",
        attributes: ["id", "contractEndDate"],
        required: true,
        include: [
          {
            model: Flat,
            as: "flat",
            attributes: [],
            required: true,
            include: [
              {
                model: Building,
                as: "building",
                required: true,
                attributes: [],
                where: {
                  propertyId,
                },
              },
            ],
          },
        ],
      },
    ],
  });
  if (!renewalRequest) {
    throw new AppError(reference, "Renewal request not found", "custom", 404);
  }
  const newContractStartDate = moment(renewalRequest.contract.contractEndDate)
    .add(1, "days")
    .startOf("day");

  const updatedData = {
    isApproved: true,
    description: description ? description : null,
    isDiscountRequired: isDiscountRequired ? true : false,
    discount: {
      amount: 0,
      grace: 0,
    },
    discountPeriod: discountPeriod ? parseInt(discountPeriod) : 0,
    currency: currency ? currency : renewalRequest.currency,
  };

  if (contractEndDate) {
    const endDate = isValidDateTime(contractEndDate);
    if (endDate < new Date()) {
      throw new AppError(
        reference,
        "Contract End Date cannot be less than current Date",
        "custom",
        412
      );
    }

    const contractDifference = moment(endDate).diff(
      newContractStartDate,
      "months"
    );

    if (
      paymentFrequency == PAYMENT_FREQUENCIES.QUARTERLY &&
      contractDifference % 3
    ) {
      throw new AppError(
        reference,
        "Enter valid contract timings depending on quarterly frequency",
        "custom",
        412
      );
    } else if (
      paymentFrequency == PAYMENT_FREQUENCIES.MONTHLY &&
      contractDifference % 1
    ) {
      throw new AppError(
        reference,
        "Enter valid contract timings depending on monthly frequency",
        "custom",
        412
      );
    } else if (
      paymentFrequency == PAYMENT_FREQUENCIES.HALF_YEARLY &&
      contractDifference % 6
    ) {
      throw new AppError(
        reference,
        "Enter valid contract timings depending on half yearly frequency",
        "custom",
        412
      );
    } else if (
      paymentFrequency == PAYMENT_FREQUENCIES.YEARLY &&
      contractDifference % 12
    ) {
      throw new AppError(
        reference,
        "Enter valid contract timings depending on yearly frequency",
        "custom",
        412
      );
    }

    updatedData["contractEndDate"] = endDate;
    updatedData["moveOutDate"] = endDate;
  }

  if (rentAmount) {
    updatedData["rentAmount"] = parseFloat(rentAmount);
  }

  if (flatUsage) {
    updatedData["flatUsage"] = flatUsage;
  }

  if (paymentFrequency) {
    updatedData["paymentFrequency"] = paymentFrequency;
  }

  if (isDiscountRequired && !applicableOn) {
    throw new AppError(
      reference,
      "Discount applicability is required when availing discount",
      "custom",
      412
    );
  }

  if (isDiscountRequired && applicableOn) {
    if (!Object.values(DISCOUNT_APPLICABILITY).includes(applicableOn)) {
      throw new AppError(
        reference,
        `Discount applicability can have ${Object.values(
          DISCOUNT_APPLICABILITY
        ).join(", ")} values`,
        "custom",
        412
      );
    }
    if (applicableOn == DISCOUNT_APPLICABILITY.INSTALLMENT && discountValue) {
      updatedData.discount.amount = parseFloat(discountValue);
    } else if (applicableOn == DISCOUNT_APPLICABILITY.GRACE && discountValue) {
      updatedData.discount.grace = parseInt(discountValue);
    }
  }
  await ContractRenewal.update(updatedData, { where: params });
  return null;
};

const getRenewRequestDetails = async ({ id, propertyId }) => {
  const reference = `getRenewRequestDetails`;
  const request = await ContractRenewal.findOne({
    where: { id },

    attributes: {
      include: [
        [db.sequelize.col(`"contract->resident".id`), "resident.id"],
        [db.sequelize.col(`"contract->resident".name`), "resident.name"],
        [db.sequelize.col(`"contract->resident".email`), "resident.email"],
        [
          db.sequelize.col(`"contract->resident".countryCode`),
          "resident.countryCode",
        ],
        [
          db.sequelize.col(`"contract->resident".mobileNumber`),
          "resident.mobileNumber",
        ],
        [db.sequelize.col(`"contract->flat".id`), "flat.id"],
        [db.sequelize.col(`"contract->flat".name_en`), "flat.name_en"],
        [db.sequelize.col(`"contract->flat".name_ar`), "flat.name_ar"],
        [db.sequelize.col(`"contract->flat->building".id`), "building.id"],
        [
          db.sequelize.col(`"contract->flat->building".name_en`),
          "building.name_en",
        ],
        [
          db.sequelize.col(`"contract->flat->building".name_ar`),
          "building.name_ar",
        ],
      ],
    },
    nest: true,
    raw: true,
    include: [
      {
        model: FlatContract,
        as: "contract",
        attributes: [],
        include: [
          {
            model: MasterUser,
            as: "resident",
            attributes: [],
          },
          {
            model: Flat,
            as: "flat",
            attributes: [],
            include: [
              {
                model: Building,
                as: "building",
                attributes: [],
                where: {
                  propertyId,
                },
              },
            ],
          },
        ],
      },
    ],
  });
  if (!request) {
    throw new AppError(reference, "No requests found", "custom", 404);
  }
  return request;
};

const rejectRenewRequestDetails = async ({ id, propertyId }) => {
  const reference = `rejectRenewRequestDetails`;
  const renewalRequest = await ContractRenewal.findOne({
    where: { id, isApproved: false },
    include: [
      {
        model: FlatContract,
        as: "contract",
        attributes: [],
        required: true,
        include: [
          {
            model: Flat,
            as: "flat",
            attributes: [],
            required: true,
            include: [
              {
                model: Building,
                as: "building",
                required: true,
                attributes: [],
                where: {
                  propertyId,
                },
              },
            ],
          },
        ],
      },
    ],
  });
  if (!renewalRequest) {
    throw new AppError(reference, "Renewal request not found", "custom", 404);
  }
  ContractRenewal.destroy({ where: { id } });
  return null;
};

const contractRenewalCron = async () => {
  const startOfToday = moment().startOf("day").toDate();
  const endOfToday = moment().endOf("day").toDate();

  const renewalRequest = await ContractRenewal.findAll({
    where: {
      isApproved: true,
      newContractId: null,
    },
    include: [
      {
        model: FlatContract,
        as: "contract",
        required: true,
        where: {
          [Op.and]: [
            db.sequelize.literal(
              `"contract"."contractEndDate" + "contract"."grace" * INTERVAL '1 month' between '${startOfToday.toISOString()}' and '${endOfToday.toISOString()}'`
            ),
          ],
        },
      },
    ],
  });

  renewalRequest.map(async (request) => {
    const transaction = await db.sequelize.transaction();

    try {
      const newContractStartDate = moment(request.contract.contractEndDate)
        .add(1, "days")
        .startOf("day");
      const newContractData = {
        flatId: request.contract.flatId,
        masterUserId: request.contract.masterUserId,
        flatUsage: request.flatUsage,
        contractStartDate: newContractStartDate,
        contractEndDate: request.contractEndDate,
        moveOutDate: request.contractEndDate,
        securityDeposit: request.contract.securityDeposit,
        activationFee: request.contract.activationFee,
        paymentFrequency: request.paymentFrequency,
        paymentMode: request.contract.paymentMode,
        currency: request.contract.currency,
        noticePeriod: request.contract.noticePeriod,
        grace:
          request.isDiscountRequired &&
          request.applicableOn == DISCOUNT_APPLICABILITY.GRACE &&
          request.discount.grace
            ? request.discount.grace
            : 0,
      };
      const newContract = await FlatContract.create(newContractData, {
        transaction,
      });
      if (request.isDiscountRequired) {
        const discountData = {
          contractId: newContract.id,
          amount: request.discount.amount,
          grace: request.discount.grace,
        };
        await Discount.create(discountData, { transaction });
      }
      createContractPayments(
        newContract,
        request.rentAmount,
        request.discount.amount,
        request.discountPeriod
      );
      request.newContractId = newContract.id;
      await request.save({ transaction });
      await transaction.commit();
    } catch (error) {
      logger.warn(error.message);
      await transaction.rollback();
    }
  });
};
const declinedRequestsListings = async (
  params,
  propertyId,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  const param = {};
  param[Op.and] = [{ newContractId: null }];
  if (params.search) {
    param[Op.and].push({
      [Op.or]: [
        {
          "$contract->resident.email$": { [Op.iLike]: `%${params.search}%` },
        },
        {
          "$contract->resident.mobileNumber$": {
            [Op.iLike]: `%${params.search}%`,
          },
        },
        {
          [`$contract->flat->building.name_${language}$`]: {
            [Op.iLike]: `%${params.search}%`,
          },
        },
        {
          [`$contract->flat.name_${language}$`]: {
            [Op.iLike]: `%${params.search}%`,
          },
        },
      ],
    });
  }

  const declinedRequests = await ContractRenewal.findAndCountAll({
    where: param,
    paranoid: true,
    attributes: {
      include: [
        [db.sequelize.col(`"contract->resident".id`), "resident.id"],
        [db.sequelize.col(`"contract->resident".name`), "resident.name"],
        [db.sequelize.col(`"contract->resident".email`), "resident.email"],
        [
          db.sequelize.col(`"contract->resident".countryCode`),
          "resident.countryCode",
        ],
        [
          db.sequelize.col(`"contract->resident".mobileNumber`),
          "resident.mobileNumber",
        ],
        [db.sequelize.col(`"contract->flat".id`), "flat.id"],
        [db.sequelize.col(`"contract->flat".name_en`), "flat.name_en"],
        [db.sequelize.col(`"contract->flat".name_ar`), "flat.name_ar"],
        [db.sequelize.col(`"contract->flat->building".id`), "building.id"],
        [
          db.sequelize.col(`"contract->flat->building".name_en`),
          "building.name_en",
        ],
        [
          db.sequelize.col(`"contract->flat->building".name_ar`),
          "building.name_ar",
        ],
      ],
    },
    nest: true,
    raw: true,
    paranoid: true,
    include: [
      {
        model: FlatContract,
        as: "contract",
        attributes: [],
        required: true,
        include: [
          {
            model: MasterUser,
            as: "resident",
            attributes: [],
          },
          {
            model: Flat,
            as: "flat",
            attributes: [],
            required: true,
            include: [
              {
                model: Building,
                as: "building",
                required: true,
                attributes: [],
                where: {
                  propertyId,
                },
              },
            ],
          },
        ],
      },
    ],

    offset,
    limit,
  });
  return declinedRequests;
};

const declinedRequestsListingsByBuildingId = async (
  params,
  propertyId,
  buildingId,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  const param = {};
  param[Op.and] = [{ newContractId: null }];
  if (params.search) {
    param[Op.and].push({
      [Op.or]: [
        {
          "$contract->resident.email$": { [Op.iLike]: `%${params.search}%` },
        },
        {
          "$contract->resident.mobileNumber$": {
            [Op.iLike]: `%${params.search}%`,
          },
        },
        {
          [`$contract->flat->building.name_${language}$`]: {
            [Op.iLike]: `%${params.search}%`,
          },
        },
        {
          [`$contract->flat.name_${language}$`]: {
            [Op.iLike]: `%${params.search}%`,
          },
        },
      ],
    });
  }

  const declinedRequests = await ContractRenewal.findAndCountAll({
    where: param,
    paranoid: true,
    attributes: {
      include: [
        [db.sequelize.col(`"contract->resident".id`), "resident.id"],
        [db.sequelize.col(`"contract->resident".name`), "resident.name"],
        [db.sequelize.col(`"contract->resident".email`), "resident.email"],
        [
          db.sequelize.col(`"contract->resident".countryCode`),
          "resident.countryCode",
        ],
        [
          db.sequelize.col(`"contract->resident".mobileNumber`),
          "resident.mobileNumber",
        ],
        [db.sequelize.col(`"contract->flat".id`), "flat.id"],
        [db.sequelize.col(`"contract->flat".name_en`), "flat.name_en"],
        [db.sequelize.col(`"contract->flat".name_ar`), "flat.name_ar"],
        [db.sequelize.col(`"contract->flat->building".id`), "building.id"],
        [
          db.sequelize.col(`"contract->flat->building".name_en`),
          "building.name_en",
        ],
        [
          db.sequelize.col(`"contract->flat->building".name_ar`),
          "building.name_ar",
        ],
      ],
    },
    nest: true,
    raw: true,
    include: [
      {
        model: FlatContract,
        as: "contract",
        attributes: [],
        required: true,
        include: [
          {
            model: MasterUser,
            as: "resident",
            attributes: [],
          },
          {
            model: Flat,
            as: "flat",
            attributes: [],
            where: { buildingId },
            required: true,
            include: [
              {
                model: Building,
                as: "building",
                required: true,
                attributes: [],
                where: {
                  propertyId,
                },
              },
            ],
          },
        ],
      },
    ],

    offset,
    limit,
  });
  return declinedRequests;
};

module.exports = {
  renewContractForUser,
  renewContractForAdmin,
  getRenewalRequestsForAdmin,
  approveRequest,
  getRenewRequestDetails,
  rejectRenewRequestDetails,
  contractRenewalCron,
  declinedRequestsListings,
  declinedRequestsListingsByBuildingId,
};
