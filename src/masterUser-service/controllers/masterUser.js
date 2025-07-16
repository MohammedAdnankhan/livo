const { Op, where } = require("sequelize");
const { getAdminForFlat } = require("../../admin-service/controllers/admin");
const Building = require("../../building-service/models/Building");
const {
  TIMEZONES,
  USER_ROLES,
  LEASE_STATUSES,
  MASTER_USER_TYPES,
  USER_FILTERS,
  GENDERS,
  // SIGNUP_REQUEST_REJECTED,
} = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const FlatContract = require("../../flatContract-service/models/FlatContract");
const { getUser } = require("../../user-service/controllers/user");
// const Email = require("../../utils/email");
const { singUpApprovedForUser } = require("../../utils/email");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const BankDetail = require("../models/BankDetail");
const MasterUser = require("../models/MasterUser");
const { isArrayEmpty, isObjEmpty } = require("../../utils/utility");
const {
  getLeaseWithLatestStatus,
} = require("../../lease-service/controllers/lease");
const {
  createActiveLeaseForTenantSignup,
} = require("../../lease-service/controllers/lease.wrapper");
const User = require("../../user-service/models/User");
// const { getFlatCount } = require("../../flat-service/controllers/flat");

//create master user
const createMasterUser = async (data) => {
  const reference = "createMasterUser";
  if (!data.email || !data.mobileNumber || !data.countryCode || !data.name) {
    throw new AppError(reference, "Required fields are empty", "custom", 412);
  }

  if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(data.email)) {
    throw new AppError(reference, "Enter valid Email", "custom", 422);
  }

  if (!/^[0-9]+$/.test(data.mobileNumber)) {
    throw new AppError(reference, "Enter valid Mobile Number", "custom", 422);
  }

  const [userFromEmail, userFromMobileNumber] = await Promise.all([
    getMasterUser({ email: data.email }),
    getMasterUser({ mobileNumber: data.mobileNumber }),
  ]);

  if (userFromEmail) {
    throw new AppError(reference, "Email already exists", "custom", 409);
  }

  if (userFromMobileNumber) {
    throw new AppError(
      reference,
      "Mobile number already exists",
      "custom",
      409
    );
  }

  data.documentDetails = {
    passportImage:
      data.passportImage && Array.isArray(data.passportImage)
        ? data.passportImage
        : null,
    govIdImage:
      data.govIdImage && Array.isArray(data.govIdImage)
        ? data.govIdImage
        : null,
    documentExpiry: data.documentExpiry ? data.documentExpiry : null,
  };
  data.alternateContact = {
    countryCode: data.alternateCountryCode ? data.alternateCountryCode : null,
    mobileNumber: data.alternateMobileNumber
      ? data.alternateMobileNumber
      : null,
    email: data.alternateEmail ? data.alternateEmail : null,
  };

  const masterUser = await MasterUser.create(data);

  const bankDetails = {
    masterUserId: masterUser.id,
    accountNumber: data.accountNumber ? data.accountNumber : null,
    accountHolderName: data.accountHolderName ? data.accountHolderName : null,
    bankName: data.bankName ? data.bankName : null,
    swiftCode: data.swiftCode ? data.swiftCode : null,
    iban: data.iban ? data.iban : null,
  };
  await BankDetail.create(bankDetails);
  return {
    id: masterUser.id,
    name: masterUser.name,
    email: masterUser.email,
    countryCode: masterUser.countryCode,
    mobileNumber: masterUser.mobileNumber,
  };
};

//TODO: deprecate function. To be removed
const getPotentialTenantsList = async (params) => {
  const query = `
  select mu.id, mu.email, mu."countryCode", mu."mobileNumber", mu.name, mu."profilePicture",
  case 
    when fc.id is not null and fo."ownedFlats" is not null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident Owner'
    when fc.id is not null and fo."ownedFlats" is null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident'
    when fc.id is null and fo."ownedFlats" is not null then 'Owner'
    else 'New User' end as "userType",
  count (*) over () as count from master_users mu
  left join (
    select distinct on("masterUserId") * from flat_contracts 
    where "deletedAt" is null
    order by "masterUserId", "createdAt" desc
    ) fc on fc."masterUserId" = mu.id
  left join (
    select count(*) as "ownedFlats", "ownerId" from flats where "deletedAt" is null group by "ownerId"
  ) fo on (fo."ownerId" = mu.id)
    where mu."deletedAt" is null and mu."propertyId" = :propertyId ${
      params.search
        ? `and (
        mu.name ilike '%${params.search}%'
        or mu."mobileNumber" ilike '%${params.search}%'
        or mu."email" ilike '%${params.search}%'
      )`
        : ""
    } and (fc.id is null or now() > fc."contractEndDate" + interval '1 month' * fc.grace or fc."isValid" is false)`;

  const potentialTenants = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
    },
  });
  const count = potentialTenants[0]?.count ? +potentialTenants[0].count : 0;
  potentialTenants.map((user) => delete user.count);
  return { count, rows: potentialTenants };
};

/**
 * @async
 * @function getUserDetails
 * @param {object} params
 * @param {string} params.id - Master User Id
 * @param {string} params.propertyId - Property Id of admin
 * @description Get details of a user
 * @returns {Promise<object>}
 */
const getUserDetails = async (params) => {
  const reference = "getUserDetails";
  const userAttributes = [
    "id",
    "userId",
    "name",
    "profilePicture",
    "countryCode",
    "mobileNumber",
    "email",
    "dateOfBirth",
    "nationality",
    "gender",
    "documentType",
    "documentId",
    "alternateContact",
    "documents",
  ];

  const userLeasesQuery = `
    SELECT l.id, ls.status, f.id AS "flat.id", f.name_en AS "flat.name_en", f."flatType" AS "flat.flatType",
    b.name_en AS "flat.building.name_en", b.address_en AS "flat.building.address_en" FROM leases l
    JOIN (
      SELECT DISTINCT ON("leaseId") "leaseId", status FROM lease_statuses WHERE "deletedAt" IS NULL
      ORDER BY "leaseId", "createdAt" DESC
    ) ls ON (ls."leaseId" = l.id)
    JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL)
    WHERE l."masterUserId" = :muId AND l."deletedAt" IS NULL ORDER BY l."createdAt" DESC`;

  const userLeasesQueryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      muId: params.id,
    },
  };

  const [userEntity, leases] = await Promise.all([
    MasterUser.findOne({
      where: { ...params, isCompany: false },
      attributes: userAttributes,
      include: [
        {
          model: Flat,
          as: "ownedFlats",
          attributes: ["id", "name_en", "flatType"],
          required: false,
          include: [
            {
              model: Building,
              as: "building",
              required: false,
              attributes: ["name_en", "address_en"],
            },
          ],
        },
        {
          model: BankDetail,
          as: "bankDetails",
          required: true,
          attributes: [
            "accountNumber",
            "accountHolderName",
            "bankName",
            "swiftCode",
            "iban",
          ],
        },
      ],
    }),
    db.sequelize.query(userLeasesQuery, userLeasesQueryConfig),
  ]);
  if (!userEntity) {
    throw new AppError(reference, "User not found", "custom", 404);
  }

  const user = JSON.parse(JSON.stringify(userEntity));

  let userType = MASTER_USER_TYPES.NEW_USER;

  if (
    (isArrayEmpty(leases) || leases[0].status !== LEASE_STATUSES.ACTIVE) &&
    !isArrayEmpty(user.ownedFlats)
  ) {
    userType = MASTER_USER_TYPES.OWNER;
  } else if (
    !isArrayEmpty(leases) &&
    !isArrayEmpty(user.ownedFlats) &&
    leases[0].status === LEASE_STATUSES.ACTIVE
  ) {
    userType = MASTER_USER_TYPES.RESIDENT_OWNER;
  } else if (
    isArrayEmpty(user.ownedFlats) &&
    !isArrayEmpty(leases) &&
    leases[0].status === LEASE_STATUSES.ACTIVE
  ) {
    userType = MASTER_USER_TYPES.RESIDENT;
  }

  return {
    ...user,
    userType,
    leases,
  };
};

const countAndGetUsersFromProperty = async (params, { offset, limit }) => {
  const reference = `countAndGetUsersFromProperty`;
  if (params.userType && !Object.values(USER_ROLES).includes(params.userType)) {
    throw new AppError(
      reference,
      `User roles can only be ${Object.values(USER_ROLES).join(", ")}`,
      "custom",
      412
    );
  }

  const query = `
  select mu.id, mu."userId", mu.name, mu.email, mu."countryCode", mu."mobileNumber", mu."documentType", mu."documentId",
  mu.gender, mu."dateOfBirth", mu.nationality,
  case 
    when fc.id is not null and fo."ownedFlats" is not null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident Owner'
    when fc.id is not null and fo."ownedFlats" is null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident'
    when (fc.id is null or fc."isValid" is false or fc."contractEndDate" + interval '1 month' * fc.grace < now()) and fo."ownedFlats" is not null then 'Owner'
    else 'New User' end as "userType",
  case when fo."ownedFlats" is null then 0 else fo."ownedFlats" end as "ownedFlats",
  fc.id as "contractDetails.id", fc."contractId" as "contractDetails.contractId",
  case when fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then false else true end as "contractDetails.isExpired",
  f.id as "contractDetails.flat.id", f.name_en as "contractDetails.flat.name_en", f.name_ar as "contractDetails.flat.name_ar",
  b.id as "contractDetails.flat.building.id", b.name_en as "contractDetails.flat.building.name_en", b.name_ar as "contractDetails.flat.building.name_ar",
  COUNT (*) OVER () as count
  from master_users mu
  left join (
    select distinct on("masterUserId") id, "masterUserId", "flatId", "isValid", "contractEndDate", "contractId", grace
    from flat_contracts
    where "deletedAt" is null
    order by "masterUserId", "createdAt" desc
  ) fc on fc."masterUserId" = mu.id
  left join flats f on (f.id = fc."flatId" and f."deletedAt" is null)
  left join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
  left join (
    select count(*) as "ownedFlats", "ownerId" from flats where "deletedAt" is null group by "ownerId"
  ) fo on (fo."ownerId" = mu.id)
  where mu."deletedAt" is null and mu."propertyId" = :propertyId ${
    params.search
      ? `and (mu.name ilike '%${params.search}%'
      or mu."countryCode" ilike '%${params.search}%' 
      or mu."mobileNumber" ilike '%${params.search}%' 
      or mu."userId"::VARCHAR ilike '%${params.search}%' 
      or mu."email" ilike '%${params.search}%' 
      or mu."documentType" ilike '%${params.search}%' 
      or mu."documentId" ilike '%${params.search}%' 
      or mu."gender" ilike '%${params.search}%' 
      or mu."dateOfBirth" ilike '%${params.search}%' 
      or mu."nationality" ilike '%${params.search}%' 
      or (f.name_en ilike '%${params.search}%' and fc."isValid" is true and fc."contractEndDate" > now())
      or (b.name_en ilike '%${params.search}%' and fc."isValid" is true and fc."contractEndDate" > now())
      )`
      : ""
  } ${
    params.userType === USER_ROLES.OWNER
      ? `AND (fc.id is null or fc."isValid" is false or fc."contractEndDate" + interval '1 month' * fc.grace < now()) and fo."ownedFlats" is not null `
      : ``
  }
  ${
    params.userType === USER_ROLES.RESIDENT
      ? `AND fc.id is not null and fo."ownedFlats" is null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now()`
      : ``
  }
   ${
     params.userType === USER_ROLES.RESIDING_OWNER
       ? `AND fc.id is not null and fo."ownedFlats" is not null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() `
       : ``
   }
   order by mu."createdAt" desc
   limit :limit offset :offset
  
  `;
  const masterUsers = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      limit,
      offset,
    },
  });
  const count = masterUsers[0]?.count ? parseInt(masterUsers[0]?.count) : 0;
  masterUsers.map((user) => {
    delete user.count;
    if (!user.contractDetails?.id) {
      user.contractDetails = null;
    }
  });
  return { count, rows: masterUsers };
};

const countAndGetUsersFromBuilding = async (params, { offset, limit }) => {
  const reference = `countAndGetUsersFromBuilding`;
  if (params.userType && !Object.values(USER_ROLES).includes(params.userType)) {
    throw new AppError(
      reference,
      `User roles can only be ${Object.values(USER_ROLES).join(", ")}`,
      "custom",
      412
    );
  }
  const query = `
  select mu.id, mu."userId", mu.name, mu.email, mu."countryCode", mu."mobileNumber", mu."documentType", mu."documentId",
  mu.gender, mu."dateOfBirth", mu.nationality,
  case 
    when fc.id is not null and fo."ownedFlats" is not null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident Owner'
    when fc.id is not null and fo."ownedFlats" is null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident'
    when (fc.id is null or fc."isValid" is false or fc."contractEndDate" + interval '1 month' * fc.grace < now()) and fo."ownedFlats" is not null then 'Owner'
    else 'New User' end as "userType",
  case when fo."ownedFlats" is null then 0 else fo."ownedFlats" end as "ownedFlats",
  fc.id as "contractDetails.id", fc."contractId" as "contractDetails.contractId",
  case when fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then false else true end as "contractDetails.isExpired",
  f.id as "contractDetails.flat.id", f.name_en as "contractDetails.flat.name_en", f.name_ar as "contractDetails.flat.name_ar",
  b.id as "contractDetails.flat.building.id", b.name_en as "contractDetails.flat.building.name_en", b.name_ar as "contractDetails.flat.building.name_ar",
  COUNT (*) OVER () as count
  from master_users mu
  left join (
    select distinct on("masterUserId") id, "masterUserId", "flatId", "isValid", "contractEndDate", "contractId", grace
    from flat_contracts
    where "deletedAt" is null
    order by "masterUserId", "createdAt" desc
  ) fc on fc."masterUserId" = mu.id
  left join flats f on (f.id = fc."flatId" and f."deletedAt" is null)
  left join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
  left join (
    select count(*) as "ownedFlats", "ownerId" from flats where "deletedAt" is null group by "ownerId"
  ) fo on (fo."ownerId" = mu.id)
  where mu."deletedAt" is null and b.id = :buildingId ${
    params.search
      ? `and (mu.name ilike '%${params.search}%'
      or mu."countryCode" ilike '%${params.search}%' 
      or mu."mobileNumber" ilike '%${params.search}%' 
      or mu."email" ilike '%${params.search}%' 
      or mu."documentType" ilike '%${params.search}%' 
      or mu."documentId" ilike '%${params.search}%' 
      or mu."gender" ilike '%${params.search}%' 
      or mu."dateOfBirth" ilike '%${params.search}%' 
      or mu."nationality" ilike '%${params.search}%' 
      or mu."userId"::VARCHAR ilike '%${params.search}%' 
      or (f.name_en ilike '%${params.search}%' and fc."isValid" is true and fc."contractEndDate" > now())
      or (b.name_en ilike '%${params.search}%' and fc."isValid" is true and fc."contractEndDate" > now())
      )`
      : ""
  }
  ${
    params.userType === USER_ROLES.OWNER
      ? `AND (fc.id is null or fc."isValid" is false or fc."contractEndDate" + interval '1 month' * fc.grace < now()) and fo."ownedFlats" is not null`
      : ``
  }
  ${
    params.userType === USER_ROLES.RESIDENT
      ? `AND fc.id is not null and fo."ownedFlats" is null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now()`
      : ``
  }
   ${
     params.userType === USER_ROLES.RESIDING_OWNER
       ? `AND fc.id is not null and fo."ownedFlats" is not null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() `
       : ``
   }
   order by mu."createdAt" desc
   limit :limit offset :offset
  `;
  const masterUsers = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      buildingId: params.buildingId,
      limit,
      offset,
    },
  });
  const count = masterUsers[0]?.count ? parseInt(masterUsers[0]?.count) : 0;
  return { count, rows: masterUsers };
};

const getAllUsers = async (params) => {
  const query = `
  select mu.id, mu.email, mu."countryCode", mu."mobileNumber", mu.name, mu."profilePicture",
  case 
    when fc.id is not null and fo."ownedFlats" is not null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident Owner'
    when fc.id is not null and fo."ownedFlats" is null and fc."isValid" is true and fc."contractEndDate" + interval '1 month' * fc.grace > now() then 'Resident'
    when fc.id is null and fo."ownedFlats" is not null then 'Owner'
    else 'New User' end as "userType",
  count (*) over () as count from master_users mu
  left join (
    select distinct on("masterUserId") * from flat_contracts 
    where "deletedAt" is null
    order by "masterUserId", "createdAt" desc
    ) fc on fc."masterUserId" = mu.id
  left join (
    select count(*) as "ownedFlats", "ownerId" from flats where "deletedAt" is null group by "ownerId"
  ) fo on (fo."ownerId" = mu.id)
    where mu."deletedAt" is null and mu."propertyId" = :propertyId ${
      params.search
        ? `and (
        mu.name ilike '%${params.search}%'
        or mu."mobileNumber" ilike '%${params.search}%'
        or mu."email" ilike '%${params.search}%'
      )`
        : ""
    }`;

  const users = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
    },
  });
  const count = users[0]?.count ? +users[0].count : 0;
  users.map((user) => delete user.count);
  return { count, rows: users };
};

//deny a user
const denyUser = async ({ requestedFlat }) => {
  const user = await getUser({
    requestedFlat,
    flatId: null,
  });
  if (!user) {
    throw new AppError("denyUser", "Request not found", "custom", 404);
  }
  const { name, email } = user;
  await user.destroy();

  // new Email({ name, email })
  //   .send(SIGNUP_REQUEST_REJECTED.SUBJECT, SIGNUP_REQUEST_REJECTED.TEMPLATE)
  //   .then(() => {
  //     logger.info(`Email sent to ${email} for ${SIGNUP_REQUEST_REJECTED.KEY}`);
  //   })
  //   .catch((err) => {
  //     console.log(err);
  //     logger.error(
  //       `Error while sending email to ${email} for ${SIGNUP_REQUEST_REJECTED.KEY}`
  //     );
  //   });

  return "Request denied";
};

//approve a user
const approveUser = async (data, timezone = TIMEZONES.INDIA) => {
  const user = await getUser({
    requestedFlat: data.requestedFlat,
    flatId: null,
  });
  if (!user) {
    throw new AppError("approveUser", "Request not found", "custom", 404);
  }

  const masterUserParams = { mobileNumber: user.mobileNumber };

  const masterUserData = {
    mobileNumber: user.mobileNumber,
    email: user.email,
    countryCode: user.countryCode,
    name: user.name,
    propertyId: data.propertyId,
    profilePicture: user.profilePicture ? user.profilePicture : null,
    documents:
      data?.documents && data?.documents?.length ? data.documents : null,
    nationality: data.nationality ? data.nationality : null,
    documentType: data.documentType ? data.documentType : null,
    documentId: data.documentId ? data.documentId : null,
    documentDetails: {
      documentImage: data.documentImage ? data.documentImage : null,
      documentExpiry: data.documentExpiry ? data.documentExpiry : null,
    },
    alternateContact: {
      mobileNumber: data.alternateMobileNumber
        ? data.alternateMobileNumber
        : null,
      email: data.alternateEmail ? data.alternateEmail : null,
    },
  };

  const masterUser = await findOrCreateMasterUser(
    masterUserParams,
    masterUserData
  );

  if (masterUser.isCreated) {
    const bankDetails = {
      masterUserId: masterUser.id,
      accountNumber: data.accountNumber ? data.accountNumber : null,
      accountHolderName: data.accountHolderName ? data.accountHolderName : null,
      bankName: data.bankName ? data.bankName : null,
      swiftCode: data.swiftCode ? data.swiftCode : null,
      iban: data.iban ? data.iban : null,
    };
    await BankDetail.create(bankDetails);
  }

  const contractData = {
    flatId: data.requestedFlat,
    startDate: data.startDate,
    endDate: data.endDate,
    flatUsage: data.flatUsage,
    moveInDate: data.moveInDate,
    moveOutDate: data.moveOutDate,
    securityDeposit: data.securityDeposit,
    activationFee: data.activationFee,
    paymentFrequency: data.paymentFrequency,
    paymentMode: data.paymentMode,
    noticePeriod: data.noticePeriod,
    rentAmount: data.rentAmount,
    currency: data.currency,
    discount: data.discount,
  };
  const masterUserId = masterUser.id;
  await createActiveLeaseForTenantSignup(contractData, masterUserId);
  await user.update({
    flatId: data.requestedFlat,
  });

  //send email to user
  getAdminForFlat(data.requestedFlat)
    .then((admin) => {
      const emailToUserObj = {
        residentName: user.name,
        adminMobileNumber: admin.mobileNumber,
      };
      singUpApprovedForUser(user.email, emailToUserObj);
    })
    .catch((err) => {
      logger.error(`Error in approveUser: ${JSON.stringify(err)}`);
    });
  return null;
};

async function getMasterUser(params) {
  return await MasterUser.findOne({ where: params });
}

async function getUserCount(params) {
  return await MasterUser.findOne({
    where: params,
    attributes: [
      [db.sequelize.fn("count", db.sequelize.col("id")), "totalResidents"],
    ],
    raw: true,
  });
}

async function findOrCreateMasterUser(params, data) {
  let masterUser = await getMasterUser(params);
  let isCreated = false;
  if (!masterUser) {
    masterUser = await MasterUser.create(data);
    isCreated = true;
  }
  return { ...masterUser.get({ plain: true }), isCreated };
}

async function deleteMasterUser(params) {
  const reference = "deleteMasterUser";
  const user = await MasterUser.findOne({
    where: params,
    include: [
      {
        model: FlatContract,
        as: "contractDetails",
        required: false,
        attributes: [],
      },
      {
        model: Flat,
        as: "ownedFlats",
        attributes: [],
        required: false,
      },
    ],
    group: "MasterUser.id",
    attributes: {
      include: [
        [
          db.sequelize.cast(
            db.sequelize.literal(`COUNT("contractDetails".id)`),
            "INTEGER"
          ),
          "contracts",
        ],
        [
          db.sequelize.cast(
            db.sequelize.literal(`COUNT("ownedFlats".id)`),
            "INTEGER"
          ),
          "ownedFlatsCount",
        ],
      ],
    },
  });
  if (!user) {
    throw new AppError(reference, "User not found", "custom", 404);
  }

  if (user.get("contracts")) {
    throw new AppError(
      reference,
      "A contract exist in user's name",
      "custom",
      412
    );
  }

  if (user.get("ownedFlatsCount")) {
    throw new AppError(reference, "Units are owned by the user", "custom", 412);
  }
  await user.destroy();
  return null;
}

async function getUsersInPropertyForExport(params) {
  const query = `
  select mu.name, mu.email, mu."countryCode", mu."mobileNumber", mu."documentType", mu."documentId",
  mu.gender, mu."dateOfBirth", mu.nationality, mu."profilePicture", 
  mu.documents, mu."documentDetails"->'passportImage' as "passport", mu."documentDetails"->'govIdImage' as "govId",
  case 
      WHEN l.id IS NOT NULL AND fo."ownedFlats" IS NOT NULL AND l.status IN (:activeLeaseStatus) THEN '${
        MASTER_USER_TYPES.RESIDENT_OWNER
      }'
      WHEN l.id IS NOT NULL AND fo."ownedFlats" IS NULL AND l.status IN (:activeLeaseStatus) THEN '${
        MASTER_USER_TYPES.RESIDENT
      }'
      WHEN (l.id IS NULL OR l.status IN (:inActiveLeaseStatuses)) AND fo."ownedFlats" IS NOT NULL THEN '${
        MASTER_USER_TYPES.OWNER
      }'
      ELSE '${MASTER_USER_TYPES.NEW_USER}'
    END AS "userType",
  CASE WHEN l.status in (:activeLeaseStatus) THEN f.name_en ELSE null END AS "tenantedFlat",
  CASE WHEN l.status in (:activeLeaseStatus) THEN b.name_en ELSE null END AS "tenantedBuilding"
  from master_users mu
  LEFT JOIN(
   SELECT DISTINCT ON(l1."masterUserId") l1.id, l1."masterUserId", l1."flatId", ls.status FROM leases l1
      JOIN lease_statuses ls ON (ls."leaseId" = l1.id AND ls."deletedAt" IS NULL)
      WHERE l1."deletedAt" IS NULL ORDER BY l1."masterUserId", l1."createdAt" DESC, ls."createdAt" DESC
    ) l ON (l."masterUserId" = mu.id)
  left join flats f on (f.id = l."flatId" and f."deletedAt" is null)
  left join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
  left join (
    select count(*) as "ownedFlats", "ownerId" from flats where "deletedAt" is null group by "ownerId"
  ) fo on (fo."ownerId" = mu.id)
  where mu."deletedAt" is null and  mu."isCompany" IS FALSE and mu."propertyId" = :propertyId ${
    params.buildingId ? `and b.id = '${params.buildingId}'` : ""
  }
  ${
    params.userType === USER_ROLES.OWNER
      ? `AND (l.id IS NULL OR l.status IN (:inActiveLeaseStatuses)) AND fo."ownedFlats" IS NOT NULL`
      : ``
  }
  ${
    params.userType === USER_ROLES.RESIDENT
      ? `AND l.id IS NOT NULL AND fo."ownedFlats" IS NULL AND l.status in (:activeLeaseStatus) `
      : ``
  }
   ${
     params.userType === USER_ROLES.RESIDING_OWNER
       ? `AND l.id IS NOT NULL AND fo."ownedFlats" IS NOT NULL AND l.status in (:activeLeaseStatus) `
       : ``
   }

   ${
     params.search
       ? `AND (
      mu.name ILIKE '%${params.search}%' OR
      mu."mobileNumber" ILIKE '%${params.search}%' OR
      mu."email" ILIKE '%${params.search}%' OR
      mu."userId"::VARCHAR ILIKE '%${params.search}%' OR
      (f.name_en ILIKE '%${params.search}%' AND l.status = :activeLeaseStatus) OR
      (b.name_en ILIKE '%${params.search}%' AND l.status = :activeLeaseStatus)
    )`
       : ""
   }
   ORDER BY mu."createdAt" DESC`;

  const masterUsers = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      inActiveLeaseStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      activeLeaseStatus: new Array(LEASE_STATUSES.ACTIVE),
    },
  });
  return masterUsers;
}

const getOwnersCount = async (params) => {
  return await MasterUser.count({
    where: params,
    distinct: true,
    attributes: [],
    include: {
      model: Flat,
      as: "ownedFlats",
      required: true,
      attributes: [],
    },
  });
};

/**
 * @async
 * @function createMasterUserV2
 * @param {import("../types").ICreateMasterUserV2} data
 * @description Function to create either a user or company
 * @returns {Promise<null>}
 */
async function createMasterUserV2(data) {
  const reference = "createMasterUserV2";
  const [userFromEmail, userFromMobileNumber] = await Promise.all([
    getMasterUser({ email: data.email }),
    getMasterUser({ mobileNumber: data.mobileNumber }),
  ]);

  if (userFromEmail) {
    throw new AppError(reference, "Email already exists", "custom", 412);
  }

  if (userFromMobileNumber) {
    throw new AppError(
      reference,
      "Mobile number already exists",
      "custom",
      412
    );
  }

  if (
    data.companyId &&
    !(await getMasterUser({
      id: data.companyId,
      isCompany: true,
      propertyId: data.propertyId,
    }))
  ) {
    throw new AppError(reference, "Company not found", "custom", 404);
  }

  const masterUser = await MasterUser.create(data);

  const bankDetails = {
    masterUserId: masterUser.id,
    accountNumber: data.accountNumber ? data.accountNumber : null,
    accountHolderName: data.accountHolderName ? data.accountHolderName : null,
    bankName: data.bankName ? data.bankName : null,
    swiftCode: data.swiftCode ? data.swiftCode : null,
    iban: data.iban ? data.iban : null,
  };
  await BankDetail.create(bankDetails);
  return null;
}

/**
 * @async
 * @function countAndGetUsers
 * @param {import("../types").ICountAndGetUsers} params
 * @param {import("../../utils/types").IPagination} paginate
 * @description Function to get all users in a property
 * @returns {Promise<{count: number, rows: object[]}>}
 */
async function countAndGetUsers(params, paginate) {
  const reference = "countAndGetUsers";

  const countAttributes = `COUNT(mu.id)::INTEGER AS count`;
  const usersAttributes = `mu.id, mu."userId", mu.name, mu.email, mu."countryCode", mu."mobileNumber",
    CASE 
      WHEN l.id IS NOT NULL AND fo."ownedFlats" IS NOT NULL AND l.status = :activeLeaseStatus THEN 'Resident Owner'
      WHEN l.id IS NOT NULL AND fo."ownedFlats" IS NULL AND l.status = :activeLeaseStatus THEN 'Resident'
      WHEN (l.id IS NULL OR l.status IN (:inActiveLeaseStatuses)) AND fo."ownedFlats" IS NOT NULL THEN 'Owner'
      ELSE 'New User'
    END AS "userType",
    CASE WHEN l.status = :activeLeaseStatus THEN f.name_en ELSE null END AS "tenantedFlat",
    CASE WHEN l.status = :activeLeaseStatus THEN b.name_en ELSE null END AS "tenantedBuilding"`;

  let logicalQuery = `master_users mu
    LEFT JOIN (
      SELECT DISTINCT ON(l1."masterUserId") l1.id, l1."masterUserId", l1."flatId", ls.status, l1."startDate", l1."endDate" FROM leases l1
      JOIN lease_statuses ls ON (ls."leaseId" = l1.id AND ls."deletedAt" IS NULL)
      WHERE l1."deletedAt" IS NULL ORDER BY l1."masterUserId", l1."createdAt" DESC, ls."createdAt" DESC
    ) l ON (l."masterUserId" = mu.id)
    LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    LEFT JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL)
    LEFT JOIN (
      SELECT count(*)::INTEGER AS "ownedFlats", "ownerId" FROM flats WHERE "deletedAt" IS NULL GROUP BY "ownerId"
    ) fo on (fo."ownerId" = mu.id)
    WHERE mu."deletedAt" IS NULL AND mu."isCompany" IS FALSE AND mu."propertyId" = :propertyId`;

  if (params.userType) {
    switch (params.userType) {
      case USER_FILTERS.OWNER:
        const ownerFilter = ` AND (l.id IS NULL OR l.status IN (:inActiveLeaseStatuses)) AND fo."ownedFlats" IS NOT NULL`;
        logicalQuery += ownerFilter;
        break;
      case USER_FILTERS.RESIDENT:
        const residentFilter = ` AND l.id IS NOT NULL AND fo."ownedFlats" IS NULL AND l.status = :activeLeaseStatus`;
        logicalQuery += residentFilter;
        break;
      case USER_FILTERS.RESIDING_OWNER:
        const residentOwnerFilter = ` AND l.id IS NOT NULL AND fo."ownedFlats" IS NOT NULL AND l.status = :activeLeaseStatus`;
        logicalQuery += residentOwnerFilter;
        break;
      case USER_FILTERS.NEW_USER:
        const newUserFilter = ` AND fo."ownedFlats" IS NULL AND (l.status IN (:inActiveLeaseStatuses) OR l.id is null)`;
        logicalQuery += newUserFilter;
        break;
      default:
        logger.warn(`Type mismatch for userType in ${reference}`);
        break;
    }
  }

  if (params.gender) {
    switch (params.gender) {
      case GENDERS.MALE:
        const maleFilter = ` AND mu.gender = '${GENDERS.MALE}'`;
        logicalQuery += maleFilter;
        break;
      case GENDERS.FEMALE:
        const femaleFilter = ` AND mu.gender = '${GENDERS.FEMALE}'`;
        logicalQuery += femaleFilter;
        break;
      case GENDERS.OTHERS:
        const othersFilter = ` AND mu.gender = '${GENDERS.OTHERS}'`;
        logicalQuery += othersFilter;
        break;
      default:
        logger.warn(`Type mismatch for genderType in ${reference}`);
        break;
    }
  }

  if (params.nationality) {
    const nationalityFilter = ` AND  mu."nationality" = '${params.nationality}'`;
    logicalQuery += nationalityFilter;
  }

  if (params.buildingId) {
    const buildingFilter = ` AND f."buildingId" = :buildingId`;
    logicalQuery += buildingFilter;
  }

  if (params.search) {
    const searchQuery = ` AND (
      mu.name ILIKE '%${params.search}%' OR
      mu."mobileNumber" ILIKE '%${params.search}%' OR
      mu."email" ILIKE '%${params.search}%' OR
      mu."userId"::VARCHAR ILIKE '%${params.search}%' OR
      (f.name_en ILIKE '%${params.search}%' AND l.status = :activeLeaseStatus) OR
      (b.name_en ILIKE '%${params.search}%' AND l.status = :activeLeaseStatus)
    )`;
    logicalQuery += searchQuery;
  }

  const usersCountQuery = `SELECT ${countAttributes} FROM ${logicalQuery} `;
  const usersDataQuery = `SELECT ${usersAttributes} FROM ${logicalQuery} ORDER BY mu."createdAt" DESC LIMIT :limit OFFSET :offset`;

  const queryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      buildingId: params.buildingId,
      activeLeaseStatus: LEASE_STATUSES.ACTIVE,
      inActiveLeaseStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED,
        LEASE_STATUSES.DRAFT
      ),
      limit: paginate.limit,
      offset: paginate.offset,
    },
  };
  const [[{ count }], users] = await Promise.all([
    db.sequelize.query(usersCountQuery, queryConfig),
    db.sequelize.query(usersDataQuery, queryConfig),
  ]);

  return {
    count,
    rows: users,
  };
}

/**
 * @async
 * @function getPotentialTenantsDropdown
 * @param {string} propertyId
 * @description Function to get potential tenants listing for dropdown
 * @returns {Promise<{object}[]>}
 */
async function getPotentialTenantsDropdown(propertyId) {
  const potentialTenantsQuery = `
    SELECT mu.id, mu.email, mu."countryCode", mu."mobileNumber", mu.name, mu."isCompany", COUNT(*) OVER ()::INTEGER AS count FROM master_users mu
    LEFT JOIN (
      SELECT DISTINCT ON("masterUserId") id, "masterUserId", "contractEndDate", grace, "isValid"
      FROM flat_contracts WHERE "deletedAt" IS NULL ORDER BY "masterUserId", "createdAt" DESC
    ) fc ON (fc."masterUserId" = mu.id)
    WHERE mu."deletedAt" IS NULL AND mu."propertyId" = :propertyId
    AND (
      fc.id IS NULL OR
      (NOW() > fc."contractEndDate" + INTERVAL '1 month' * fc.grace) OR
      fc."isValid" IS false
    ) ORDER BY mu.name ASC`;

  const tenants = await db.sequelize.query(potentialTenantsQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    replacements: {
      propertyId,
    },
  });
  const count = tenants[0] ? tenants[0].count : 0;

  tenants.forEach((tenant) => delete tenant.count);

  return {
    count,
    rows: tenants,
  };
}

/**
 * @async
 * @function getAllUsersDropdown
 * @param {string} propertyId
 * @description Function to get all users in a property for dropdowns
 * @returns {Promise<object[]>}
 */
async function getAllUsersDropdown(propertyId) {
  const attributes = [
    "id",
    "email",
    "countryCode",
    "mobileNumber",
    "name",
    "isCompany",
  ];
  return await MasterUser.findAndCountAll({
    where: { propertyId },
    attributes,
    order: [["name", "ASC"]],
  });
}

/**
 * @async
 * @function updateMasterUser
 * @param {object} params
 * @param {string} params.id - ID of master user
 * @param {string} params.propertyId - Property ID of admin
 * @param {import("../types").IUpdateUser} userData
 * @description Function to update details of a user
 * @returns {Promise<null>}
 */
async function updateMasterUser(params, userData) {
  const reference = "updateMasterUser";

  const [masterUser, ownedFlatsCount, lease] = await Promise.all([
    MasterUser.findOne({
      where: { ...params, isCompany: false },
      include: [
        {
          model: BankDetail,
          as: "bankDetails",
          required: true,
        },
      ],
    }),
    // getFlatCount({ ownerId: params.id }), //TODO: Commented due to circular dependency
    Flat.count({ where: { ownerId: params.id } }),
    getLeaseWithLatestStatus({ masterUserId: params.id }),
  ]);
  if (!masterUser) {
    throw new AppError(reference, "User not found", "custom", 404);
  }

  const { bankDetails, alternateContact, ...data } = userData;

  /*
  if ((lease && lease["statuses"][0]["status"] === LEASE_STATUSES.ACTIVE) || ownedFlatsCount) {
    if (data.name && data.name !== masterUser.name) {
      throw new AppError(
        reference,
        "Cannot edit name during ongoing lease or an active owner",
        "custom",
        412
      );
    }
    if (data.email && data.email !== masterUser.email) {
      throw new AppError(
        reference,
        "Cannot edit email during ongoing lease or an active owner",
        "custom",
        412
      );
    }

    if (data.mobileNumber && data.mobileNumber !== masterUser.mobileNumber) {
      throw new AppError(
        reference,
        "Cannot edit Mobile Number during ongoing lease or an active owner",
        "custom",
        412
      );
    }
  }
  */

  if (userData.email) {
    const [checkUser, checkMasterUser] = await Promise.all([
      MasterUser.findOne({
        where: { email: userData.email, id: { [Op.ne]: masterUser.id } },
      }),
      User.findOne({
        where: { email: userData.email },
      }),
    ]);

    if (checkUser && checkMasterUser) {
      throw new AppError(reference, "Email already exists", "custom", 412);
    }

    const transaction = await db.sequelize.transaction(); // Initalize Transaction
    try {
      const findUser = await User.findOne({
        where: { mobileNumber: masterUser.mobileNumber },
      });

      if (findUser) {
        findUser.email = userData.email;
        await findUser.save({ transaction });
      }

      masterUser.email = userData.email;
      await masterUser.save({ transaction });

      await transaction.commit(); // Transaction committed
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  if (
    data.email &&
    (await getMasterUser({ email: data.email, id: { [Op.ne]: masterUser.id } }))
  ) {
    throw new AppError(reference, "Email already exists", "custom", 412);
  }

  if (
    data.mobileNumber &&
    (await getMasterUser({
      mobileNumber: data.mobileNumber,
      id: { [Op.ne]: masterUser.id },
    }))
  ) {
    throw new AppError(
      reference,
      "Mobile number already exists",
      "custom",
      412
    );
  }

  if (!isObjEmpty(alternateContact)) {
    for (const key in alternateContact) {
      masterUser["alternateContact"][key] = alternateContact[key];
    }
    masterUser.changed("alternateContact", true);
  }

  for (const key in data) {
    masterUser[key] = data[key];
  }

  if (!isObjEmpty(bankDetails)) {
    for (const key in bankDetails) {
      masterUser["bankDetails"][key] = bankDetails[key];
    }
  }
  await Promise.all([masterUser.save(), masterUser.bankDetails.save()]);
  return null;
}

const getUsersDropDown = async (params) => {
  const query = `select mu.id, mu.name, mu.email, mu."countryCode", mu."mobileNumber",
CASE
    WHEN f.name_en IS NOT NULL THEN f.name_en
    ELSE sf.name_en
END AS flatname,
    CASE 
      WHEN mu."isCompany" = true then 'Company'
      WHEN l.id IS NOT NULL AND fo."ownedFlats" IS NOT NULL AND l.status = :activeLeaseStatus THEN 'Resident Owner'
      WHEN l.id IS NOT NULL AND fo."ownedFlats" IS NULL AND l.status = :activeLeaseStatus THEN 'Resident'
      WHEN (l.id IS NULL OR l.status IN (:inActiveLeaseStatuses)) AND fo."ownedFlats" IS NOT NULL THEN 'Owner'
      ELSE 'New User'
    END AS "userType",
b.name_en as "buildingName",
b.id as "buildingId"
from master_users mu 
       LEFT JOIN (
      SELECT DISTINCT ON(l1."masterUserId") l1.id, l1."masterUserId", l1."flatId", l1."subFlatId", ls.status, l1."startDate", l1."endDate" FROM leases l1
      JOIN lease_statuses ls ON (ls."leaseId" = l1.id AND ls."deletedAt" IS NULL)
      WHERE l1."deletedAt" IS NULL ORDER BY l1."masterUserId", l1."createdAt" DESC, ls."createdAt" DESC
    ) l ON (l."masterUserId" = mu.id)
 LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
 LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
 LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
 LEFT JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  LEFT JOIN (
      SELECT count(*)::INTEGER AS "ownedFlats", "ownerId" FROM flats WHERE "deletedAt" IS NULL GROUP BY "ownerId"
    ) fo on (fo."ownerId" = mu.id)
where mu."propertyId" = :propertyId and mu."deletedAt" is null 
order by mu."createdAt" desc`;

  return await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      inActiveLeaseStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      activeLeaseStatus: new Array(LEASE_STATUSES.ACTIVE),
    },
  });
};

module.exports = {
  createMasterUser,
  getUserDetails,
  countAndGetUsers,
  getMasterUser,
  getUserCount,
  approveUser,
  denyUser,
  getPotentialTenantsList,
  getAllUsers,
  countAndGetUsersFromProperty,
  countAndGetUsersFromBuilding,
  deleteMasterUser,
  getUsersInPropertyForExport,
  getOwnersCount,
  createMasterUserV2,
  getPotentialTenantsDropdown,
  getAllUsersDropdown,
  updateMasterUser,
  getUsersDropDown,
};
