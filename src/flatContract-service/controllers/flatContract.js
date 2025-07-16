const moment = require("moment-timezone");
const { Op } = require("sequelize");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const { AppError } = require("../../utils/errorHandler");
const {
  getDateTimeObjectFromTimezone,
  isValidDateTime,
  generatePassword,
  hashPassword,
  markObjectAsNull,
} = require("../../utils/utility");
const { deleteUser, getUser } = require("../../user-service/controllers/user");
const FlatContract = require("../models/FlatContract");
const {
  FLAT_USAGE,
  PAYMENT_FREQUENCIES,
  PAYMENT_FREQUENCY_VALUES,
  DISCOUNT_APPLICABILITY,
  TIMEZONES,
  UTC_OFFSET,
  USER_ROLES,
  LANGUAGES,
  LEASE_STATUSES,
} = require("../../config/constants");
const Discount = require("../models/Discount");
const logger = require("../../utils/logger");
const ContractPayment = require("../models/ContractPayment");
const Building = require("../../building-service/models/Building");
const User = require("../../user-service/models/User");
const UserInformation = require("../../user-service/models/UserInformation");
const {
  signupCompletedByAdminForUser,
  renewalReminderForUser,
  renewalReminderForAdmin,
} = require("../../utils/email");
const { getAdminForFlat } = require("../../admin-service/controllers/admin");
const ContractRenewal = require("../models/ContractRenewal");

//get contracts
const getContracts = async (
  params,
  { offset, limit },
  timezone = TIMEZONES.INDIA
) => {
  const contractParams = {},
    flatParams = {};
  if (params.flatUsage) {
    if (!Object.values(FLAT_USAGE).includes(params.flatUsage)) {
      throw new AppError(
        "getContracts",
        `Flat usage can only be ${Object.values(FLAT_USAGE).join(", ")}`,
        "custom",
        412
      );
    }
    contractParams.flatUsage = params.flatUsage;
  }
  params.flatId && (contractParams.flatId = params.flatId);

  contractParams.createdAt = { [Op.and]: [] };

  if (params.startDate) {
    contractParams["createdAt"][Op.and].push({
      [Op.gte]: moment(params.startDate).tz(timezone).startOf("day").toDate(),
    });
  }
  if (params.endDate) {
    contractParams["createdAt"][Op.and].push({
      [Op.lte]: moment(params.endDate).tz(timezone).endOf("day").toDate(),
    });
  }

  if (params.status && params.status == "Active") {
    contractParams.isValid = true;
    contractParams.contractEndDate = {
      [Op.gt]: moment().utcOffset(UTC_OFFSET).format(),
    };
  }
  if (params.status && params.status == "Expired") {
    contractParams[Op.or] = [
      { isValid: false },
      {
        contractEndDate: {
          [Op.lt]: moment().utcOffset(UTC_OFFSET).format(),
        },
      },
    ];
  }

  params.buildingId && (flatParams.buildingId = params.buildingId);

  if (params.search) {
    contractParams[Op.or] = [
      db.sequelize.where(
        db.sequelize.cast(
          db.sequelize.col("FlatContract.contractId"),
          "varchar"
        ),
        {
          [Op.iLike]: `%${params.search}%`,
        }
      ),
      { "$flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
      { "$flat->building.name_en$": { [Op.iLike]: `%${params.search}%` } },
      { "$flat->owner.name$": { [Op.iLike]: `%${params.search}%` } },
      { "$resident.name$": { [Op.iLike]: `%${params.search}%` } },
      { flatUsage: { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  const contracts = await FlatContract.findAndCountAll({
    distinct: true,
    where: contractParams,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: Flat,
        as: "flat",
        required: true,
        where: flatParams,
        attributes: ["id", "name_en", "name_ar", "buildingId"],
        include: [
          {
            model: MasterUser,
            as: "owner",
            required: false,
            attributes: ["id", "name"],
          },
          {
            model: Building,
            as: "building",
            required: true,
            attributes: ["id", "name_en", "name_ar"],
            where: { propertyId: params.propertyId },
          },
        ],
      },
      {
        model: MasterUser,
        as: "resident",
        required: false,
        attributes: ["id", "name"],
      },
    ],
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `(SELECT cp.amount FROM contract_payments AS cp WHERE cp."contractId" = "FlatContract".id LIMIT 1)`
          ),
          "rentAmount",
        ],
      ],
    },
  });
  const contractsObj = JSON.parse(JSON.stringify(contracts));
  contractsObj.rows.forEach((contract) => {
    const daysDifference = parseFloat(
      moment(contract.contractEndDate).diff(moment(), "days")
    );
    // const monthsDifference = parseFloat(
    //   moment(contract.contractEndDate).diff(moment(), "months")
    // ).toPrecision(2);
    // const yearsDifference = parseFloat(
    //   moment(contract.contractEndDate).diff(moment(), "years")
    // ).toPrecision(2);
    let endingIn, timePeriod;

    if (daysDifference == 1) {
      endingIn = `${daysDifference} day`;
    } else {
      endingIn = `${daysDifference} days`;
    }
    // if (monthsDifference < 1) {
    // endingIn = `${daysDifference} days`;
    // }
    // if (monthsDifference >= 1) {
    //   endingIn = `${monthsDifference} ${
    //     monthsDifference == 1 ? "month" : "months"
    //   } `;
    // }
    // if (yearsDifference >= 1) {
    //   endingIn = `${yearsDifference} years`;

    //   if (yearsDifference - Math.floor(yearsDifference) === 0) {
    //     const period = Math.floor(yearsDifference) > 1 ? "years" : "year";
    //     endingIn = `${Math.floor(yearsDifference)} ${period}`;
    //   }
    // }

    const daysDifferenceForTimePeriod = parseFloat(
      moment(contract.contractEndDate).diff(
        moment(contract.contractStartDate),
        "days"
      )
    );
    // const monthsDifferenceForTimePeriod = parseFloat(
    //   moment(contract.contractEndDate).diff(
    //     moment(contract.contractStartDate),
    //     "months"
    //   )
    // ).toPrecision(2);
    // const yearsDifferenceForTimePeriod = parseFloat(
    //   moment(contract.contractEndDate).diff(
    //     moment(contract.contractStartDate),
    //     "years"
    //   )
    // ).toPrecision(2);

    if (daysDifferenceForTimePeriod == 1) {
      timePeriod = `${daysDifferenceForTimePeriod} day`;
    } else {
      timePeriod = `${daysDifferenceForTimePeriod} days`;
    }
    // if (monthsDifferenceForTimePeriod < 1) {

    // timePeriod = `${daysDifferenceForTimePeriod} days`;
    // }
    // if (monthsDifferenceForTimePeriod >= 1) {
    //   timePeriod = `${monthsDifferenceForTimePeriod}  ${
    //     monthsDifferenceForTimePeriod == 1 ? "month" : "months"
    //   } `;
    // }
    // if (yearsDifferenceForTimePeriod >= 1) {
    //   timePeriod = `${yearsDifferenceForTimePeriod} years`;

    //   if (
    //     yearsDifferenceForTimePeriod -
    //       Math.floor(yearsDifferenceForTimePeriod) ===
    //     0
    //   ) {
    //     const period =
    //       Math.floor(yearsDifferenceForTimePeriod) > 1 ? "years" : "year";
    //     timePeriod = `${Math.floor(yearsDifferenceForTimePeriod)} ${period}`;
    //   }
    // }
    // Modify the contract object by adding the timePeriod property
    contract.endingIn = contract.isExpired === false ? endingIn : null;
    contract.timePeriod = timePeriod;
  });

  return contractsObj;
};

const getContractsForExport = async (params, timezone = TIMEZONES.INDIA) => {
  const contractParams = {},
    flatParams = {};
  if (params.flatUsage) {
    if (!Object.values(FLAT_USAGE).includes(params.flatUsage)) {
      throw new AppError(
        "getContracts",
        `Flat usage can only be ${Object.values(FLAT_USAGE).join(", ")}`,
        "custom",
        412
      );
    }
    contractParams.flatUsage = params.flatUsage;
  }
  params.flatId && (contractParams.flatId = params.flatId);

  contractParams.createdAt = { [Op.and]: [] };

  if (params.startDate) {
    contractParams["createdAt"][Op.and].push({
      [Op.gte]: moment(params.startDate).tz(timezone).startOf("day").toDate(),
    });
  }
  if (params.endDate) {
    contractParams["createdAt"][Op.and].push({
      [Op.lte]: moment(params.endDate).tz(timezone).endOf("day").toDate(),
    });
  }

  if (params.status && params.status == "Active") {
    contractParams.isValid = true;
    contractParams.contractEndDate = {
      [Op.gt]: moment().utcOffset(UTC_OFFSET).format(),
    };
  }
  if (params.status && params.status == "Expired") {
    contractParams[Op.or] = [
      { isValid: false },
      {
        contractEndDate: {
          [Op.lt]: moment().utcOffset(UTC_OFFSET).format(),
        },
      },
    ];
  }

  params.buildingId && (flatParams.buildingId = params.buildingId);

  if (params.search) {
    contractParams[Op.or] = [
      db.sequelize.where(
        db.sequelize.cast(
          db.sequelize.col("FlatContract.contractId"),
          "varchar"
        ),
        {
          [Op.iLike]: `%${params.search}%`,
        }
      ),
      { "$flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
      { "$flat->building.name_en$": { [Op.iLike]: `%${params.search}%` } },
      { "$flat->owner.name$": { [Op.iLike]: `%${params.search}%` } },
      { "$resident.name$": { [Op.iLike]: `%${params.search}%` } },
      { flatUsage: { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  const contracts = await FlatContract.findAll({
    distinct: true,
    where: contractParams,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Flat,
        as: "flat",
        required: true,
        where: flatParams,
        attributes: ["id", "name_en", "name_ar", "buildingId"],
        include: [
          {
            model: MasterUser,
            as: "owner",
            required: false,
            attributes: ["id", "name"],
          },
          {
            model: Building,
            as: "building",
            required: true,
            attributes: ["id", "name_en", "name_ar"],
            where: { propertyId: params.propertyId },
          },
        ],
      },
      {
        model: MasterUser,
        as: "resident",
        required: false,
        attributes: ["id", "name"],
      },
    ],
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `(SELECT cp.amount FROM contract_payments AS cp WHERE cp."contractId" = "FlatContract".id LIMIT 1)`
          ),
          "rentAmount",
        ],
      ],
    },
  });
  const contractsObj = JSON.parse(JSON.stringify(contracts));
  contractsObj.forEach((contract) => {
    const daysDifference = parseFloat(
      moment(contract.contractEndDate).diff(moment(), "days")
    );
    const monthsDifference = parseFloat(
      moment(contract.contractEndDate).diff(moment(), "months")
    ).toPrecision(2);
    const yearsDifference = parseFloat(
      moment(contract.contractEndDate).diff(moment(), "years")
    ).toPrecision(2);
    let endingIn, timePeriod;

    if (monthsDifference < 1) {
      endingIn = `${daysDifference} days`;
    }
    if (monthsDifference > 1) {
      endingIn = `${monthsDifference} months`;
    }
    if (yearsDifference >= 1) {
      endingIn = `${yearsDifference} years`;

      if (yearsDifference - Math.floor(yearsDifference) === 0) {
        const period = Math.floor(yearsDifference) > 1 ? "years" : "year";
        endingIn = `${Math.floor(yearsDifference)} ${period}`;
      }
    }

    const daysDifferenceForTimePeriod = parseFloat(
      moment(contract.contractEndDate).diff(
        moment(contract.contractStartDate),
        "days"
      )
    );
    const monthsDifferenceForTimePeriod = parseFloat(
      moment(contract.contractEndDate).diff(
        moment(contract.contractStartDate),
        "months"
      )
    ).toPrecision(2);
    const yearsDifferenceForTimePeriod = parseFloat(
      moment(contract.contractEndDate).diff(
        moment(contract.contractStartDate),
        "years"
      )
    ).toPrecision(2);

    if (monthsDifferenceForTimePeriod < 1) {
      timePeriod = `${daysDifferenceForTimePeriod} days`;
    }
    if (monthsDifferenceForTimePeriod > 1) {
      timePeriod = `${monthsDifferenceForTimePeriod} months`;
    }
    if (yearsDifferenceForTimePeriod >= 1) {
      timePeriod = `${yearsDifferenceForTimePeriod} years`;

      if (
        yearsDifferenceForTimePeriod -
          Math.floor(yearsDifferenceForTimePeriod) ===
        0
      ) {
        const period =
          Math.floor(yearsDifferenceForTimePeriod) > 1 ? "years" : "year";
        timePeriod = `${Math.floor(yearsDifferenceForTimePeriod)} ${period}`;
      }
    }
    // Modify the contract object by adding the timePeriod property
    contract.endingIn = endingIn;
    contract.timePeriod = timePeriod;
  });

  return contractsObj;
};

//get contract
const getContract = async ({ id, propertyId }) => {
  const contract = await FlatContract.findOne({
    where: {
      id,
    },
    include: [
      {
        model: Flat,
        as: "flat",
        required: false,
        attributes: ["id", "name_en", "name_ar"],
        include: [
          {
            model: MasterUser,
            as: "owner",
            required: false,
            attributes: [
              "id",
              "name",
              "email",
              "mobileNumber",
              "profilePicture",
            ],
          },
          {
            model: Building,
            as: "building",
            required: true,
            attributes: ["id", "name_en", "name_ar"],
            where: { propertyId },
          },
        ],
      },
      {
        model: MasterUser,
        as: "resident",
        required: false,
        attributes: [
          "id",
          "name",
          "email",
          "mobileNumber",
          "profilePicture",
          "countryCode",
        ],
      },
      {
        model: ContractPayment,
        as: "contractPayments",
        attributes: ["id", "amount", "date", "discount"],
      },
      {
        model: Discount,
        as: "discount",
        attributes: ["amount", "grace", "applicableOn", "period"],
      },
    ],
  });
  if (!contract) {
    throw new AppError("getContract", "Contract not found", "custom", 404);
  }
  return contract;
};

const getContractPayments = async (params) => {
  const contract = await FlatContract.findOne({
    where: params,
  });
  if (!contract) {
    throw new AppError(
      "getContractPayments",
      "Contract not found",
      "custom",
      404
    );
  }
  const payments = await ContractPayment.findAll({
    where: {
      contractId: contract.id,
    },
    order: [["date", "ASC"]],
    attributes: {
      include: [
        [
          db.sequelize.literal(`
          CASE when "ContractPayment".date > now() then 'Upcoming' else 'Past' END`),
          "status",
        ],
      ],
      exclude: ["createdAt"],
    },
  });
  return payments;
};

//create flat contract
const createContract = async (
  data,
  timezone = TIMEZONES.INDIA,
  reverseFlow = true //reverseFlow true signifies that admin is creating contract and a user will be created against this contract
) => {
  const reference = "createContract";
  if (
    !data.masterUserId ||
    !data.flatId ||
    !data.flatUsage ||
    !("securityDeposit" in data) ||
    // !data.activationFee ||
    !data.paymentFrequency ||
    !data.paymentMode ||
    !("rentAmount" in data) ||
    !data.currency
  ) {
    const fields = [
      "masterUserId",
      "flatId",
      "flatUsage",
      "securityDeposit",
      // "activationFee",
      "paymentFrequency",
      "paymentMode",
      "rentAmount",
      "currency",
    ];
    const missingKeys = fields.filter(
      (key) => !Object.keys(data).includes(key)
    );
    throw new AppError(
      reference,
      `${missingKeys.join(", ")} ${
        missingKeys.length == 1 ? "is" : "are"
      } required`,
      "custom",
      412,
      [{ requiredFields: fields }]
    );
  }

  const flatContractParams = {
    flatId: data.flatId,
  };

  const [flat, findContract, masterUser, userContract] = await Promise.all([
    Flat.findOne({
      where: {
        id: data.flatId,
      },
      include: {
        model: Building,
        as: "building",
        required: true,
        where: { propertyId: data.propertyId },
        attributes: ["id", "name_en", "name_ar"],
      },
    }), // exposed data model here to avoid circular dependency
    getFlatContract(flatContractParams),
    MasterUser.findOne({
      where: { id: data.masterUserId, propertyId: data.propertyId },
    }),
    getFlatContract({
      masterUserId: data.masterUserId,
    }),
  ]);

  //throw error if flat is not found
  if (!flat) {
    throw new AppError(reference, "Flat not found", "custom", 404);
  }

  //throw error if contract exists and is active
  if (findContract && !findContract.isExpired) {
    throw new AppError(
      reference,
      "An ongoing contract already exists",
      "custom",
      412
    );
  }

  //throw error if user is not found
  if (!masterUser) {
    throw new AppError(reference, "Master User not found", "custom", 404);
  }

  //throw error if an ongoing contract is active against the user
  if (userContract && !userContract.isExpired) {
    throw new AppError(
      reference,
      "An ongoing contract exists in your name",
      "custom",
      412
    );
  }

  //check if there is any pending onboarding request for the selected flat when reverse flow is true
  if (reverseFlow) {
    const pendingSignup = await getUser({
      flatId: null,
      requestedFlat: data.flatId,
    });
    if (pendingSignup) {
      throw new AppError(
        reference,
        "A sign up request for the selected flat is already pending",
        "custom",
        412
      );
    }
  }

  if (!data.contractStartDate || !data.contractEndDate) {
    throw new AppError(
      reference,
      "Contract Start Date and End Date are required",
      "custom",
      412
    );
  }

  if (!Object.values(FLAT_USAGE).includes(data.flatUsage)) {
    throw new AppError(
      reference,
      `Flat usage can only be ${Object.values(FLAT_USAGE).join(", ")}`,
      "custom",
      412
    );
  }
  if (!Object.values(PAYMENT_FREQUENCIES).includes(data.paymentFrequency)) {
    throw new AppError(
      reference,
      `Payment frequency can only be ${Object.values(PAYMENT_FREQUENCIES).join(
        ", "
      )}`,
      "custom",
      412
    );
  }

  if (data.isDiscountRequired) {
    if (
      !data.applicableOn ||
      !Object.values(DISCOUNT_APPLICABILITY).includes(data.applicableOn)
    ) {
      throw new AppError(
        reference,
        `Discount applicability is required and can have ${Object.values(
          DISCOUNT_APPLICABILITY
        ).join(", ")} values`,
        "custom",
        412
      );
    }

    if (data.applicableOn == DISCOUNT_APPLICABILITY.GRACE && !data.grace) {
      throw new AppError(reference, "Grace period required", "custom", 412);
    }
  } else {
    delete data.grace;
    delete data.discountAmount;
  }

  data.contractStartDate = moment(isValidDateTime(data.contractStartDate))
    .tz(timezone)
    .startOf("day")
    .utc();

  data.contractEndDate = moment(isValidDateTime(data.contractEndDate))
    .tz(timezone)
    .endOf("day")
    .utc();

  validateDate(data.contractEndDate, timezone);
  validateContractDates(data.contractStartDate, data.contractEndDate);

  const contractDifference = data.contractEndDate.diff(
    data.contractStartDate,
    "months"
  );
  let paymentsCount =
    contractDifference / PAYMENT_FREQUENCY_VALUES[data.paymentFrequency];
  if (
    data.paymentFrequency == PAYMENT_FREQUENCIES.QUARTERLY &&
    contractDifference % 3
  ) {
    throw new AppError(
      reference,
      "Enter valid contract timings depending on quarterly frequency",
      "custom",
      412
    );
  } else if (
    data.paymentFrequency == PAYMENT_FREQUENCIES.HALF_YEARLY &&
    contractDifference % 6
  ) {
    throw new AppError(
      reference,
      "Enter valid contract timings depending on half yearly frequency",
      "custom",
      412
    );
  } else if (
    data.paymentFrequency == PAYMENT_FREQUENCIES.YEARLY &&
    contractDifference % 12
  ) {
    throw new AppError(
      reference,
      "Enter valid contract timings depending on yearly frequency",
      "custom",
      412
    );
  }
  if (data.isDiscountRequired && data.period && data.period > paymentsCount) {
    throw new AppError(
      reference,
      "Discount period can not be greater than number of payments",
      "custom",
      412
    );
  }
  data.contractStartDate = data.contractStartDate.format();
  data.contractEndDate = data.contractEndDate.format();

  if (data.moveInDate) {
    data.moveInDate = moment(isValidDateTime(data.moveInDate))
      .tz(timezone)
      .startOf("day")
      .utc()
      .format();
  }
  if (data.moveOutDate) {
    data.moveOutDate = moment(isValidDateTime(data.moveOutDate))
      .tz(timezone)
      .endOf("day")
      .utc()
      .format();
    validateDate(data.moveOutDate, timezone);
  }
  if (data.moveOutDate && data.moveInDate) {
    validateMoveDates(
      data.moveInDate,
      data.moveOutDate,
      data.contractStartDate,
      data.contractEndDate
    );
  }

  // if (data.ownerId && flat.ownerId && flat.ownerId != data.ownerId) {
  //   throw new AppError(reference, "An owner already exists!", "custom", 412);
  // }

  if (data.ownerId) {
    const owner = await MasterUser.findOne({
      where: { id: data.ownerId, propertyId: data.propertyId },
    });
    if (!owner) {
      throw new AppError(reference, "Owner not found", "custom", 404);
    }
  }

  let contract, user, discount, password;
  const transaction = await db.sequelize.transaction();
  try {
    contract = await FlatContract.create(data, { transaction });

    if (data.isDiscountRequired) {
      const discountData = {
        contractId: contract.id,
        amount:
          data.discountAmount &&
          data.applicableOn != DISCOUNT_APPLICABILITY.GRACE
            ? data.discountAmount
            : null,
        applicableOn: data.applicableOn,
        grace:
          data.grace && data.applicableOn == DISCOUNT_APPLICABILITY.GRACE
            ? data.grace
            : null,
      };
      discount = await Discount.create(discountData, { transaction });
    }

    if (data.ownerId) {
      await Flat.update(
        { ownerId: data.ownerId },
        { where: { id: data.flatId }, transaction }
      );
    }
    if (reverseFlow) {
      //create a user
      password = generatePassword();
      const userData = {
        name: masterUser.name,
        email: masterUser.email,
        countryCode: masterUser.countryCode,
        mobileNumber: masterUser.mobileNumber,
        profilePicture: masterUser.profilePicture || null,
        password: await hashPassword(password),
        flatId: flat.id,
        emailVerified: false,
        role: USER_ROLES.RESIDENT,
        language: LANGUAGES.EN,
      };
      const findDeletedUser = await User.findOne({
        where: {
          [Op.or]: [
            { mobileNumber: userData.mobileNumber },
            { email: userData.email },
          ],
          deletedAt: { [Op.ne]: null },
        },
        paranoid: false,
      });
      if (findDeletedUser) {
        for (const key in findDeletedUser.get({ plain: true })) {
          findDeletedUser[key] = null;
        }
        for (const key in userData) {
          findDeletedUser[key] = userData[key];
        }
        await findDeletedUser.save({ transaction });
        await findDeletedUser.restore({ transaction });
        user = findDeletedUser;
      } else {
        user = await User.create(userData, { transaction });
      }
      await UserInformation.findOrCreate({
        where: { userId: user.id },
        transaction,
      });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  //create contract payments
  let rentalDiscount = 0,
    discountPeriod = 0;
  if (discount && discount.applicableOn == DISCOUNT_APPLICABILITY.INSTALLMENT) {
    rentalDiscount = discount.amount ? discount.amount : 0;
    discountPeriod = data.period ? data.period : 0;
  }

  createContractPayments(
    contract,
    data.rentAmount,
    rentalDiscount,
    discountPeriod
  ).catch((err) => {
    console.log(err);
    logger.error(
      `Error while creating contract payments for contract ID - ${contract.id}`
    );
  });
  if (reverseFlow) {
    //send email to the user
    const emailToUserObj = {
      buildingName: flat.building.name_en,
      residentName: user.name,
      residentMobileNumber: `+${user.mobileNumber}`,
      password,
    };
    signupCompletedByAdminForUser(user.email, emailToUserObj);
  }
  return null;
};

//edit flat contract
const editContract = async (data, timezone) => {
  if (!data.flatContractId) {
    throw new AppError(
      "editContract",
      "Flat Contract ID is required",
      "custom",
      412
    );
  }
  const params = { id: data.flatContractId };

  delete data.flatContractId;
  delete data.flatId;
  delete data.masterUserId;
  //remove all keys that can't be edited
  const flatContract = await FlatContract.findOne({ where: params });
  if (!flatContract) {
    throw new AppError("editContract", "Contract not found", "custom", 404);
  }
  if (data.contractStartDate) {
    data.contractStartDate = getDateTimeObjectFromTimezone(
      data.contractStartDate,
      timezone
    );
  }
  if (data.contractEndDate) {
    data.contractEndDate = getDateTimeObjectFromTimezone(
      data.contractEndDate,
      timezone
    );
    validateDate(data.contractEndDate, timezone);
  }

  if (data.contractStartDate && data.contractEndDate) {
    validateContractDates(data.contractStartDate, data.contractEndDate);
  }
  if (data.moveInDate) {
    data.moveInDate = getDateTimeObjectFromTimezone(data.moveInDate, timezone);
  }
  if (data.moveOutDate) {
    data.moveOutDate = getDateTimeObjectFromTimezone(
      data.moveOutDate,
      timezone
    );
    validateDate(data.moveOutDate, timezone);
  }
  if (data.moveOutDate && data.moveInDate) {
    const startDate = data.contractStartDate
      ? data.contractStartDate
      : flatContract.contractStartDate;
    const endDate = data.contractEndDate
      ? data.contractEndDate
      : flatContract.contractEndDate;
    validateMoveDates(data.moveInDate, data.moveOutDate, startDate, endDate);
  }
  for (let key in data) {
    flatContract[key] = data[key];
  }
  await flatContract.save();
  return await FlatContract.findOne({ where: params });
};

//remove resident from a flat
const voidContract = async (data) => {
  if (!data.expiryReason) {
    throw new AppError(
      "voidContract",
      "Reason is required for terminating the lease",
      "custom",
      412
    );
  }
  const flatContract = await FlatContract.findOne({
    where: { id: data.contractId },
  });
  if (!flatContract) {
    throw new AppError(
      "voidContract",
      "Flat Contract not found",
      "custom",
      404
    );
  }

  if (flatContract.isExpired) {
    throw new AppError(
      "voidContract",
      "Contract already invalid",
      "custom",
      412
    );
  }

  flatContract.set({
    isValid: false,
    expiryReason: data.expiryReason,
    expiredAt: moment().utcOffset(UTC_OFFSET).format(),
  });

  await flatContract.save();
  await deleteUser({ flatId: flatContract.flatId }, null);
  return;
};

function validateDate(dateTime, timezone) {
  if (!dateTime || !timezone) {
    throw new AppError(
      "validateDate",
      "Date and Timezone are required",
      "custom",
      412
    );
  }
  if (dateTime < moment().tz(timezone).startOf("day").utc().format()) {
    throw new AppError("validateDate", "Enter valid date", "custom", 412);
  }
}

function validateContractDates(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new AppError(
      "validateContractDates",
      "Contract Start date and End date are required",
      "custom",
      412
    );
  }
  if (endDate < startDate) {
    throw new AppError(
      "validateContractDates",
      "Start date cannot be greater than end date",
      "custom",
      412
    );
  } else if (moment(endDate).diff(moment(startDate), "months") < 1) {
    throw new AppError(
      "validateContractDates",
      "Contract time frame cannot be less than 1 month",
      "custom",
      412
    );
  }
}

function validateMoveDates(inDate, outDate, startDate, endDate) {
  if (!inDate || !outDate || !startDate || !endDate) {
    throw new AppError(
      "validateMoveDates",
      "Contract start date, contract end date, move in date and move out date are required",
      "custom",
      412
    );
  }
  if (outDate < inDate || startDate > inDate || outDate > endDate) {
    throw new AppError(
      "validateMoveDates",
      "Enter valid move in and move out dates",
      "custom",
      412
    );
  }
}

async function getOccupiedFlatCount(params) {
  return await FlatContract.findOne({
    attributes: [
      [db.sequelize.fn("count", db.sequelize.col("flatId")), "flatsOccupied"],
    ],
    where: {
      contractEndDate: {
        [Op.gt]: new Date(),
      },
    },
    raw: true,
    include: {
      model: Flat,
      as: "flat",
      required: true,
      attributes: [],
      where: params,
    },
  });
}

async function getResidingOwnerCount(params) {
  return await FlatContract.findOne({
    attributes: [
      [db.sequelize.fn("count", db.sequelize.col("flatId")), "residingOwners"],
    ],
    raw: true,
    include: {
      model: Flat,
      as: "flat",
      required: true,
      attributes: [],
      where: {
        ...params,
        ownerId: { [Op.col]: "FlatContract.masterUserId" },
      },
    },
  });
}

async function getFlatContract(params) {
  return (
    await FlatContract.findAll({
      where: params,
      limit: 1,
      order: [["createdAt", "DESC"]],
    })
  )?.[0];
}

async function createContractPayments(
  contract,
  rentAmount,
  discount,
  discountFrequency
) {
  const { paymentFrequency, createdAt } = contract,
    paymentsData = [],
    firstPaymentDate = moment(createdAt)
      .tz(TIMEZONES.INDIA)
      .startOf("day")
      .utc(),
    contractEndDate = moment(contract.contractEndDate)
      .tz(TIMEZONES.INDIA)
      .endOf("day")
      .utc(); //TODO: contractEndDate already in mentioned format

  //subtract respective time from contractEndDate to make it exclusive
  if (paymentFrequency == PAYMENT_FREQUENCIES.MONTHLY) {
    contractEndDate.subtract(1, "month");
  } else if (paymentFrequency == PAYMENT_FREQUENCIES.QUARTERLY) {
    contractEndDate.subtract(3, "month");
  } else if (paymentFrequency == PAYMENT_FREQUENCIES.HALF_YEARLY) {
    contractEndDate.subtract(6, "month");
  } else if (paymentFrequency == PAYMENT_FREQUENCIES.YEARLY) {
    contractEndDate.subtract(1, "year");
  } else {
    throw new AppError(
      "createContractPayments",
      "Payment Frequency mismatch",
      "custom",
      412
    );
  }
  let count = Number(discountFrequency);
  switch (paymentFrequency) {
    case PAYMENT_FREQUENCIES.MONTHLY:
      while (firstPaymentDate < contractEndDate) {
        paymentsData.push({
          contractId: contract.id,
          amount: rentAmount,
          date: firstPaymentDate.format(),
          discount: count > 0 ? discount : 0,
        });
        count--;
        firstPaymentDate.add(1, "month");
      }
      break;
    case PAYMENT_FREQUENCIES.QUARTERLY:
      while (firstPaymentDate < contractEndDate) {
        paymentsData.push({
          contractId: contract.id,
          amount: rentAmount,
          date: firstPaymentDate.format(),
          discount: count > 0 ? discount : 0,
        });
        count--;
        firstPaymentDate.add(3, "month");
      }
      break;
    case PAYMENT_FREQUENCIES.HALF_YEARLY:
      while (firstPaymentDate < contractEndDate) {
        paymentsData.push({
          contractId: contract.id,
          amount: rentAmount,
          date: firstPaymentDate.format(),
          discount: count > 0 ? discount : 0,
        });
        count--;
        firstPaymentDate.add(6, "month");
      }
      break;
    case PAYMENT_FREQUENCIES.YEARLY:
      while (firstPaymentDate < contractEndDate) {
        paymentsData.push({
          contractId: contract.id,
          amount: rentAmount,
          date: firstPaymentDate.format(),
          discount: count > 0 ? discount : 0,
        });
        count--;
        firstPaymentDate.add(1, "year");
      }
      break;

    default:
      logger.warn(
        `No payment frequency found to create contract payments for contract ID - ${contract.id}`
      );
      break;
  }
  await ContractPayment.bulkCreate(paymentsData);
  logger.info(
    `Contract payments list created for contract ID - ${contract.id}`
  );
  return;
}

async function createFlatContract(data, transaction = null) {
  const contractData = {
    flatId: data.flatId,
    masterUserId: data.masterUserId,
    flatUsage: data.flatUsage,
    contractStartDate: data.contractStartDate,
    contractEndDate: data.contractEndDate,
    moveInDate: data.moveInDate,
    moveOutDate: data.moveOutDate,
    securityDeposit: data.securityDeposit,
    activationFee: data.activationFee,
    paymentFrequency: data.paymentFrequency,
    paymentMode: data.paymentMode,
    currency: data.currency,
    noticePeriod: data.noticePeriod,
  };
  const contract = await FlatContract.create(contractData, { transaction });
  if (data.isDiscountRequired) {
    const discountData = {
      contractId: contract.id,
    };
    await Discount.create(discountData, { transaction });
  }
  if (
    data.paymentsData &&
    Array.isArray(data.paymentsData) &&
    data.paymentsData?.length
  ) {
    await ContractPayment.bulkCreate(
      data.paymentsData.map((payment) => {
        return { ...payment, contractId: contract.id };
      }),
      { transaction }
    );
  }
  return contract;
}

async function contractExpiryCron() {
  const query = `
  select u.id, u."mobileNumber" from flats f
    join (
      select distinct on("flatId") * from flat_contracts 
      where "deletedAt" is null
      order by "flatId", "createdAt" desc
    ) fc on fc."flatId" = f.id
    join buildings b on b.id = f."buildingId"
    join users u on u."flatId" = f.id and u."deletedAt" is null
    where f."deletedAt" is null
    and (fc.id is null or now() > fc."contractEndDate" + interval '1 month' * fc.grace or fc."isValid" is false)`;

  const expiredUsers = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
  });
  logger.info(
    `Found ${expiredUsers.length} users whose contracts have expired`
  );
  await Promise.all(
    expiredUsers.map(async (user) => {
      await deleteUser({ id: user.id }, null);
    })
  );
  return {
    removedUsers: expiredUsers.length,
    users: expiredUsers,
  };
}

const renewalRemindersCron = async () => {
  const contracts = await FlatContract.findAll({
    where: db.sequelize.literal(
      `"FlatContract"."isValid" is TRUE AND (("FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace") - now()) <= INTERVAL '10 days'`
    ),
    include: {
      model: MasterUser,
      as: "resident",
      attributes: ["name", "email"],
      required: true,
    },
  });

  Promise.all(
    contracts.map(async (contract) => {
      //send email to the user
      const admin = await getAdminForFlat(contract.flatId);

      const emailToUserObj = {
        residentName: contract.resident.name,
      };
      const emailToAdminObj = {
        adminName: admin.name,
      };
      renewalReminderForUser(contract.resident.email, emailToUserObj);
      renewalReminderForAdmin(admin.email, emailToAdminObj);
    })
  );
  return contracts.length;
};

const flatContractStats = async ({ propertyId }) => {
  const [
    activeContracts,
    perviousActiveContracts,
    contractRenewals,
    previousContractRenewals,
    expiredContracts,
    previousExpiredContracts,
    newContracts,
    perviousNewContracts,
  ] = await Promise.all([
    FlatContract.count({
      where: db.sequelize.literal(
        `"FlatContract"."isValid" is TRUE AND (("FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace") > now())`
      ),
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              where: {
                propertyId,
              },
              attributes: [],
            },
          ],
        },
      ],
    }),
    FlatContract.count({
      where: {
        isValid: true,
        [Op.and]: [
          db.sequelize.literal(
            `"FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace" > DATE_TRUNC('month', NOW() - INTERVAL '1 month')`
          ),
          db.sequelize.literal(
            `("FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace" <= 
             (DATE_TRUNC('month', NOW() - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 second'))
             OR
            ("FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace" > 
            (DATE_TRUNC('month', NOW() - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 second'))`
          ),
          db.sequelize.literal(
            `DATE_TRUNC('month', "FlatContract"."createdAt") < DATE_TRUNC('month', NOW())`
          ),
        ],
      },
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              where: {
                propertyId,
              },
              attributes: [],
            },
          ],
        },
      ],
    }),
    ContractRenewal.count({
      where: {
        [Op.and]: [
          db.sequelize.literal(
            `(DATE("ContractRenewal"."createdAt") < (DATE_TRUNC('month', now())) ) and (("ContractRenewal"."isApproved" = true) and ("ContractRenewal"."deletedAt") is null)`
          ),
        ],
      },
      include: [
        {
          model: FlatContract,
          as: "contract",
          required: true,
          attributes: [],
          include: [
            {
              model: Flat,
              as: "flat",
              required: true,
              attributes: [],
              include: [
                {
                  model: Building,
                  as: "building",
                  required: true,
                  where: {
                    propertyId,
                  },
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
    }),
    ContractRenewal.count({
      where: {
        [Op.and]: [
          db.sequelize.literal(
            `(DATE("ContractRenewal"."createdAt") between (DATE_TRUNC('month', now()-INTERVAL '1 month')) and (DATE_TRUNC('month', now()-INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 second'))and (("ContractRenewal"."isApproved" = true) and ("ContractRenewal"."deletedAt") is null)`
          ),
        ],
      },
      include: [
        {
          model: FlatContract,
          as: "contract",
          required: true,
          attributes: [],
          include: [
            {
              model: Flat,
              as: "flat",
              required: true,
              attributes: [],
              include: [
                {
                  model: Building,
                  as: "building",
                  required: true,
                  where: {
                    propertyId,
                  },
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
    }),

    FlatContract.count({
      where: {
        [Op.and]: [
          db.sequelize.literal(
            `(DATE("FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace") < now())  or ("isValid" =false and DATE("expiredAt") < now())`
          ),
        ],
      },
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              where: {
                propertyId,
              },
              attributes: [],
            },
          ],
        },
      ],
    }),
    FlatContract.count({
      where: {
        [Op.and]: [
          db.sequelize.literal(
            `( DATE("FlatContract"."contractEndDate" + INTERVAL '1 month' * "FlatContract"."grace")between  (DATE_TRUNC('month', now()-INTERVAL '1 month')) and (DATE_TRUNC('month', now()) - INTERVAL '1 second') ) or ("isValid" =false and DATE("expiredAt") between (DATE_TRUNC('month', now()-INTERVAL '1 month')) and (DATE_TRUNC('month', now())- INTERVAL '1 second'))`
          ),
        ],
      },
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              where: {
                propertyId,
              },
              attributes: [],
            },
          ],
        },
      ],
    }),

    FlatContract.count({
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              where: {
                propertyId,
              },
              attributes: [],
            },
          ],
        },
      ],
    }),

    FlatContract.count({
      where: {
        [Op.and]: [
          db.sequelize.literal(
            `DATE("FlatContract"."createdAt")between  (DATE_TRUNC('month', now())- INTERVAL '1 month') and ((DATE_TRUNC('month', now()))  - INTERVAL '1 second') `
          ),
        ],
      },
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              where: {
                propertyId,
              },
              attributes: [],
            },
          ],
        },
      ],
    }),
  ]);
  // let activeContractsPercentage = null;
  // if (perviousActiveContracts) {
  //   activeContractsPercentage = parseFloat(
  //     (
  //       ((activeContracts - perviousActiveContracts) /
  //         perviousActiveContracts) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!perviousActiveContracts && !activeContracts) {
  //   activeContractsPercentage = 0;
  // }

  // let contractRenewalPercentage = null;
  // if (previousContractRenewals) {
  //   contractRenewalPercentage = parseFloat(
  //     (
  //       ((contractRenewals - previousContractRenewals) /
  //         previousContractRenewals) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!contractRenewals && !previousContractRenewals) {
  //   contractRenewalPercentage = 0;
  // }

  // let expiredContractPercentage = null;
  // if (previousExpiredContracts) {
  //   expiredContractPercentage = parseFloat(
  //     (
  //       ((expiredContracts - previousExpiredContracts) /
  //         previousExpiredContracts) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!previousExpiredContracts && !expiredContracts) {
  //   expiredContractPercentage = 0;
  // }

  // let newContractPercentage = null;
  // if (perviousNewContracts) {
  //   newContractPercentage = parseFloat(
  //     (
  //       ((newContracts - perviousNewContracts) / perviousNewContracts) *
  //       100
  //     ).toFixed(2)
  //   );
  // } else if (!newContracts && !perviousNewContracts) {
  //   newContractPercentage = 0;
  // }
  //TODO: have to add renewed contracts in this api
  const responseObj = {
    active: {
      total: activeContracts,
      previousMonth: perviousActiveContracts,
      // percentageDifference: activeContractsPercentage,
      // isIncreasing:
      //   activeContractsPercentage > 0 || activeContractsPercentage == null
      //     ? true
      //     : false,
    },
    renewed: {
      total: contractRenewals,
      previousMonth: previousContractRenewals,
      // percentageDifference: contractRenewalPercentage,
      // isIncreasing:
      //   contractRenewalPercentage > 0 || contractRenewalPercentage == null
      //     ? true
      //     : false,
    },
    expired: {
      total: expiredContracts,
      previousMonth: previousExpiredContracts,
      // percentageDifference: expiredContractPercentage,
      // isIncreasing:
      //   expiredContractPercentage > 0 || expiredContractPercentage == null
      //     ? true
      //     : false,
    },
    new: {
      total: newContracts,
      previousMonth: perviousNewContracts,
      // percentageDifference: newContractPercentage,
      // isIncreasing:
      //   newContractPercentage > 0 || newContractPercentage == null
      //     ? true
      //     : false,
    },
  };

  return responseObj;
};

async function getOccupiedFlatCountForUnitStat(
  startDate,
  endDate,
  propertyId,
  buildingId
) {
  // startDate = new Date(startDate);
  // endDate = new Date(endDate);
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  let result;
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  if (timeDifference <= oneDay) {
    const query = `SELECT COUNT(*) AS count,
       TO_CHAR(DATE_TRUNC('hour', fc."createdAt"::timestamp)
       - (DATE_PART('hour', fc."createdAt"::timestamp)::integer % 3) * interval '1 hour', 'HH24:MI')
       || '-'
       || TO_CHAR(DATE_TRUNC('hour', fc."createdAt"::timestamp)
       - (DATE_PART('hour', fc."createdAt"::timestamp)::integer % 3) * interval '1 hour' + interval '3 hours', 'HH24:MI') AS date_time_range
FROM flat_contracts fc INNER JOIN "flats" AS f ON fc."flatId" = f.id INNER JOIN "buildings" AS b ON f."buildingId" = b.id AND ("f"."deletedAt" IS NULL  AND b."deletedAt" is null AND  b."propertyId" = '${propertyId}'
${buildingId ? `AND f."buildingId"='${buildingId}'` : ""})
 where fc."contractEndDate" + INTERVAL '1 month' * fc."grace"  > '${new Date().toISOString()}' and fc."createdAt" between  TIMESTAMP WITH TIME ZONE '${startDate.toISOString()}' AND  TIMESTAMP WITH TIME ZONE  '${endDate.toISOString()}' and fc."deletedAt" is null
GROUP BY date_time_range
ORDER BY date_time_range ASC;`;
    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
    });
  } else if (timeDifference <= oneWeek) {
    const query = `SELECT
 CASE
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 0 THEN 'Sun'
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 1 THEN 'Mon'
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 2 THEN 'Tue'
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 3 THEN 'Wed'
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 4 THEN 'Thu'
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 5 THEN 'Fri'
    WHEN EXTRACT(DOW FROM fc."createdAt"::timestamp AT TIME ZONE 'UTC') = 6 THEN 'Sat'
  END AS day_of_week,

  COUNT(*) AS count
FROM flat_contracts fc
INNER JOIN "flats" AS f ON fc."flatId" = f.id
INNER JOIN "buildings" AS b ON f."buildingId" = b.id
WHERE
  ("f"."deletedAt" IS NULL  AND  b."propertyId" = '${propertyId}'
  ${buildingId ? `AND f."buildingId"='${buildingId}'` : ""})
  AND fc."contractEndDate" + INTERVAL '1 month' * fc."grace"  > '${new Date().toISOString()}'
  AND fc."createdAt" BETWEEN TIMESTAMP WITH TIME ZONE '${startDate.toISOString()}' AND TIMESTAMP WITH TIME ZONE '${endDate.toISOString()}'
GROUP BY
  day_of_week
ORDER BY
  day_of_week ASC;
`;
    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
    });
  } else if (timeDifference <= thirtyDays) {
    const query = `SELECT
  COUNT(*) AS count,
  TO_CHAR(DATE_TRUNC('week', fc."createdAt"::timestamp AT TIME ZONE 'UTC'), 'MM/DD')
  || '-'
  || TO_CHAR(DATE_TRUNC('week', fc."createdAt"::timestamp AT TIME ZONE 'UTC') + INTERVAL '6 days', 'MM/DD') AS week_date_range
  FROM flat_contracts fc INNER JOIN "flats" AS f ON fc."flatId" = f.id INNER JOIN "buildings" AS b ON f."buildingId" = b.id AND ("f"."deletedAt" IS NULL  AND b."deletedAt" is null  AND  b."propertyId" = '${propertyId}'  and fc."deletedAt" is null
  ${buildingId ? `AND f."buildingId"='${buildingId}'` : ""})
 where fc."contractEndDate" + INTERVAL '1 month' * fc."grace"  > '${new Date().toISOString()}' and fc."createdAt"  between  TIMESTAMP WITH TIME ZONE '${startDate.toISOString()}' AND  TIMESTAMP WITH TIME ZONE  '${endDate.toISOString()}'
GROUP BY
  week_date_range
ORDER BY
  week_date_range ASC`;

    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
    });
  } else {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    const monthsInRange = [];
    const params = {};
    if (propertyId) {
      params.propertyId = propertyId;
    }
    if (buildingId) {
      params.id = buildingId;
    }

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 0;
      const monthEnd = year === endYear ? endMonth : 11;

      for (let month = monthStart; month <= monthEnd; month++) {
        monthsInRange.push({ year, month: month + 1 });
      }
    }
    const occupiedFlats = await FlatContract.findAll({
      attributes: [
        [
          db.sequelize.fn(
            "EXTRACT",
            db.sequelize.literal(`YEAR FROM ("FlatContract"."createdAt")`)
          ),
          "year",
        ],
        [
          db.sequelize.fn(
            "EXTRACT",
            db.sequelize.literal(`MONTH FROM ("FlatContract"."createdAt")`)
          ),
          "month",
        ],
        [
          db.sequelize.fn("count", db.sequelize.col(`"FlatContract."flatId"`)),
          "flatsOccupied",
        ],
      ],

      where: {
        contractEndDate: {
          [Op.gt]: new Date(),
        },
        createdAt: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      raw: true,
      include: [
        {
          model: Flat,
          as: "flat",
          required: true,
          attributes: [],
          include: {
            model: Building,
            as: "building",
            attributes: [],
            where: params,
          },
        },
      ],
      group: ["year", "month"],
    });

    const flatsMap = new Map();
    occupiedFlats.forEach((occupiedFlat) => {
      const year = occupiedFlat.year;
      const month = occupiedFlat.month;
      flatsMap.set(`${year}-${month}`, occupiedFlat);
    });

    result = monthsInRange.map(({ year, month }) => {
      const key = `${year}-${month}`;
      const flatData = flatsMap.get(key) || { year, month, flatsOccupied: 0 };
      return flatData;
    });
  }
  return result;
}

async function getFlatContractForResident({ mobileNumber }) {
  const query = `
  select fc.id, fc."contractId", fc."contractStartDate", 
  (fc."contractEndDate" + interval '1 month' * fc.grace) as "contractEndDate",
  fc."moveInDate", (fc."moveOutDate" + interval '1 month' * fc.grace) as "moveOutDate",
  fc."flatUsage", fc."securityDeposit", fc."paymentFrequency", fc."activationFee",
  fc."noticePeriod", fc."contractImage", fc."description", cp.amount as "rentAmount",
  d.amount as "discount.amount", d.grace as "discount.grace", d."applicableOn" as "discount.applicableOn",
  f.name_en as "flatName", b.name_en as "buildingName", mu1.name as "ownerName",mu1.email as "ownerEmail",
  mu1."mobileNumber" as "ownerMobileNumber",
  mu1."countryCode"as "countryCode",fc.currency
  from (
    select distinct on("flatId") * from flat_contracts
    where "deletedAt" is null
    order by "flatId", "createdAt" desc
  ) fc
  join master_users mu on (mu.id = fc."masterUserId" and mu."deletedAt" is null)
  join flats f on (f.id = fc."flatId" and f."deletedAt" is null)
  join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
  left join master_users mu1 on (mu1.id = f."ownerId" and mu1."deletedAt" is null)
  left join discounts d on (d."contractId" = fc.id and d."deletedAt" is null)
  join contract_payments cp on (cp."contractId" = fc.id and cp."deletedAt" is null)
  where mu."mobileNumber" = :mobileNumber
  and fc."contractEndDate" + interval '1 month' * fc.grace > now() 
  and fc."isValid" is true
  limit 1`;

  const contract = await db.sequelize.query(query, {
    nest: true,
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      mobileNumber,
    },
  });

  const contractObj = contract[0];
  contractObj.discount &&
    (contractObj.discount = markObjectAsNull(contractObj.discount));

  if (contractObj) {
    const { contractEndDate, noticePeriod } = contractObj;
    contractObj.isExpiring =
      moment(contractEndDate).diff(moment(), "months", true) <= +noticePeriod
        ? true
        : false;
  }
  return contractObj;
}
const getResidingOwnersCountDateWise = async (startDate, endDate, params) => {
  return await FlatContract.findOne({
    attributes: [
      [db.sequelize.fn("count", db.sequelize.col("flatId")), "residingOwners"],
    ],
    raw: true,
    where: {
      createdAt: {
        [Op.gt]: startDate,
        [Op.lt]: endDate,
      },
    },
    include: {
      model: Flat,
      as: "flat",
      required: true,
      attributes: [],
      where: {
        ...params,
        ownerId: { [Op.col]: "FlatContract.masterUserId" },
      },
    },
  });
};

const getResidentCount = async (params) => {
  return await MasterUser.count({
    where: params,
    distinct: true,
    attributes: [],
    include: {
      model: FlatContract,
      as: "contractDetails",
      required: true,
      attributes: [],
      include: {
        model: Flat,
        as: "flat",
        required: true,
        attributes: [],
      },
    },
  });
};
//TODO: To be deprecated
const getUserTypeCount = async (params) => {
  const query = `SELECT "userType", COUNT(*)::INTEGER AS "count"
FROM (
  select mu.id,
  case 
    when l.id is not null and fo."ownedFlats" is not null and l.status in (:activeStatuses) and  l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) > now() then 'Residing Owners'
    when l.id is not null and fo."ownedFlats" is null and l.status in (:activeStatuses) and l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) > now() then 'Residents'
    when (l.id is null or l.status in (:inActiveStatuses) or l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)< now()) and fo."ownedFlats" is not null then 'Owners'
    else 'New Users' end as "userType"
  from master_users mu
   join (
      select distinct on(l."flatId") l.id, l."flatId",l."masterUserId", ls.status,l."endDate",l.discount from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc, ls."createdAt" desc
    ) l on (l."masterUserId" = mu.id)
  left join flats f on (f.id = l."flatId" and f."deletedAt" is null)
  left join buildings b on (b.id = f."buildingId" and b."deletedAt" is null )
  left join (
    select count(*) as "ownedFlats", "ownerId" from flats where "deletedAt" is null group by "ownerId"
  ) fo on (fo."ownerId" = mu.id)
  WHERE mu."deletedAt" IS NULL AND mu."propertyId" = :propertyId ${
    params.buildingId ? `AND f."buildingId" = '${params.buildingId}'` : ""
  } AND mu."createdAt" between :startDate and :endDate
) AS "ownerTypeQuery"
GROUP BY "userType"`;

  const userType = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      startDate: params.startDate,
      endDate: params.endDate,
      inActiveStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      activeStatuses: new Array(LEASE_STATUSES.ACTIVE),
    },
  });
  let userCountParams = {
    "Residing Owners": 0,
    Residents: 0,
    Owners: 0,
    "New Users": 0,
  };
  userType.forEach((userCount) => {
    userCountParams[userCount.userType] = userCount.count;
  });
  return userCountParams;
};

module.exports = {
  createContract,
  editContract,
  voidContract,
  getOccupiedFlatCount,
  getResidingOwnerCount,
  getFlatContract,
  getContracts,
  getContract,
  getContractPayments,
  createFlatContract,
  contractExpiryCron,
  renewalRemindersCron,
  flatContractStats,
  createContractPayments,
  getOccupiedFlatCountForUnitStat,
  getFlatContractForResident,
  getContractsForExport,
  getResidingOwnersCountDateWise,
  getResidentCount,
  getUserTypeCount,
};
