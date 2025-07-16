const { Op } = require("sequelize");
const {
  BUILDING_LANGUAGE_VARS,
  BUILDING_LANGUAGE_KEYS,
} = require("../../building-service/configs/constants");
const Building = require("../../building-service/models/Building");
const {
  CITY_LANGUAGE_VARS,
  CITY_LANGUAGE_KEYS,
} = require("../../city-service/configs/constants");
const City = require("../../city-service/models/City");
const {
  LANGUAGES,
  CURRENCY,
  FLAT_TYPES,
  FLAT_FURNISHINGS,
  CONTRACT_STATUSES,
  FLAT_STATUSES,
  LEASE_STATUSES,
} = require("../../config/constants");
const db = require("../../database");
const FlatContract = require("../../flatContract-service/models/FlatContract");
const {
  LOCALITY_LANGUAGE_VARS,
  LOCALITY_LANGUAGE_KEYS,
} = require("../../locality-service/configs/constants");
const Locality = require("../../locality-service/models/Locality");
const {
  getMasterUser,
} = require("../../masterUser-service/controllers/masterUser");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const User = require("../../user-service/models/User");
const { AppError } = require("../../utils/errorHandler");
const {
  enableSearch,
  generatePassword,
  hashPassword,
} = require("../../utils/utility");
const { FLAT_LANGUAGE_VARS } = require("../configs/constants");
const Flat = require("../models/Flat");
const FlatInformation = require("../models/FlatInformation");
const { getBuilding } = require("../../building-service/controllers/building");
const moment = require("moment-timezone");
const SubFlat = require("../../subFlat-service/models/SubFlat");
const {
  getOwner,
  createOwner,
} = require("../../owner-service/controllers/owner");
const { createOwnerFlat } = require("./ownerFlat");
const logger = require("../../utils/logger");
const Lease = require("../../lease-service/models/Lease");
const LeaseStatus = require("../../lease-service/models/LeaseStatus");
const {
  getTenantDetailsFromLease,
} = require("../../lease-service/controllers/lease");

const getFlats = async (params = {}, language = LANGUAGES.EN) => {
  enableSearch(params, "name", language);
  const flats = await Flat.scope("languageHelper").findAll({
    where: params,
    order: [
      ["floor", "ASC"],
      [`name_${language}`, "ASC"],
    ],
    attributes: { include: Object.entries(FLAT_LANGUAGE_VARS[language]) },
  });

  return flats;
};

const addFlat = async (data = {}) => {
  const reference = "addFlat";
  if (!data.flatType || !data.buildingId) {
    throw new AppError(
      reference,
      "Flat Type and building Id are required",
      "custom",
      412
    );
  }
  //TODO: validate if admin has access to the selected building
  if (!Object.values(FLAT_TYPES).includes(data.flatType)) {
    throw new AppError(
      reference,
      `Flat type can only be ${Object.values(FLAT_TYPES).join(", ")}`,
      "custom",
      412
    );
  }

  if (data.amenities && !Array.isArray(data.amenities)) {
    throw new AppError(reference, "Invalid amenities format", "custom", 412);
  }

  if (
    data.furnishing &&
    !Object.values(FLAT_FURNISHINGS).includes(data.furnishing)
  ) {
    throw new AppError(
      reference,
      `Furnishing can only be ${Object.values(FLAT_FURNISHINGS).join(", ")}`,
      "custom",
      412
    );
  }

  if (
    data.purchaseCurrency &&
    !Object.values(CURRENCY).includes(data.purchaseCurrency)
  ) {
    throw new AppError(
      reference,
      `Purchase currency can only be ${Object.values(CURRENCY).join(", ")}`,
      "custom",
      412
    );
  }

  if (data.amenities && !Array.isArray(data.amenities)) {
    throw new AppError(reference, "Invalid amenities type", "custom", 412);
  }

  if (data.ownerId) {
    const owner = await getMasterUser({ id: data.ownerId });
    if (!owner) {
      throw new AppError(reference, "Owner not found", "custom", 404);
    }
  }
  //validate if that flat already exists
  const existingFlat = await Flat.findOne({
    where: {
      name_en: data.name_en,
      buildingId: data.buildingId,
    },
  });

  if (existingFlat) {
    throw new AppError(reference, "Flat already exists", "custom", 412);
  }

  //validate if unit Id already exists
  if (data.unitId) {
    const flatWithUnitId = await Flat.findOne({
      where: {
        unitId: data.unitId,
      },
    });
    if (flatWithUnitId) {
      throw new AppError(
        reference,
        "Unit with mentioned Government Id already exists",
        "custom",
        412
      );
    }
  }
  let flat = null;
  const flatInfoData = {
    bedroom: data.bedroom ? data.bedroom : null,
    bathroom: data.bathroom ? data.bathroom : null,
    primaryContact: {
      name: data.contactName ? data.contactName : null,
      countryCode: data.contactCountryCode ? data.contactCountryCode : null,
      mobileNumber: data.contactMobileNumber ? data.contactMobileNumber : null,
      email: data.contactEmail ? data.contactEmail : null,
    },
    furnishing: data.furnishing ? data.furnishing : null,
    purchaseCurrency: data.purchaseCurrency ? data.purchaseCurrency : null,
    amenities: data.amenities ? data.amenities : null,
    purchasePrice: data.purchasePrice ? data.purchasePrice : null,
    purchaseDate: data.purchaseDate ? data.purchaseDate : null,
    poaDetails: {
      name: data.poaName ? data.poaName : null,
      countryCode: data.poaCountryCode ? data.poaCountryCode : null,
      mobileNumber: data.poaMobileNumber ? data.poaMobileNumber : null,
      email: data.poaEmail ? data.poaEmail : null,
    },
  };
  try {
    flat = await Flat.create(data);
    flatInfoData.flatId = flat.id;

    await FlatInformation.create(flatInfoData);

    // if (data.subFlats.length) {
    //   for (const subFlat of data.subFlats) {
    //     await SubFlat.create({ ...subFlat, flatId: flat.id });
    //   }
    // }
  } catch (error) {
    flat = await Flat.findOne({
      where: {
        name_en: data.name_en,
        buildingId: data.buildingId,
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });
    if (!flat) {
      throw error;
    }
    const flatInfo = await FlatInformation.findOne({
      where: {
        flatId: flat.id,
      },
      paranoid: false,
    });

    if (!flatInfo) {
      throw error;
    }

    for (const key in flat.get({ plain: true })) {
      flat[key] = null;
    }
    for (const key in data) {
      flat[key] = data[key];
    }

    for (const key in flatInfo.get({ plain: true })) {
      flatInfo[key] = null;
    }
    flatInfo.flatId = flat.id;
    for (const key in flatInfoData) {
      flatInfo[key] = flatInfoData[key];
    }

    await Promise.all([
      flat.save(),
      flat.restore(),
      flatInfo.save(),
      flatInfo.restore(),
    ]);
  }

  return { id: flat.id, name_en: flat.name_en };
};

const getFlat = async (params = {}, language = LANGUAGES.EN) => {
  return await Flat.scope("languageHelper").findOne({
    where: params,
    attributes: { include: Object.entries(FLAT_LANGUAGE_VARS[language]) },
  });
};

const getFlatWithCityAndCountry = async (
  params = {},
  language = LANGUAGES.EN
) => {
  return await Flat.scope("languageHelper").findOne({
    where: params,
    attributes: { include: Object.entries(FLAT_LANGUAGE_VARS[language]) },
    include: {
      model: Building,
      as: "building",
      attributes: {
        exclude: BUILDING_LANGUAGE_KEYS,
        include: Object.entries(BUILDING_LANGUAGE_VARS[language]),
      },
      include: {
        model: Locality,
        as: "locality",
        attributes: {
          exclude: LOCALITY_LANGUAGE_KEYS,
          include: Object.entries(LOCALITY_LANGUAGE_VARS[language]),
        },
        include: {
          model: City,
          scope: "languageHelper",
          as: "city",
          attributes: {
            include: Object.entries(CITY_LANGUAGE_VARS[language]),
            exclude: CITY_LANGUAGE_KEYS,
          },
        },
      },
    },
  });
};

async function getFlatAddress(params, language = LANGUAGES.EN) {
  const flatLocation = (
    await db.sequelize.query(
      `
    select f.name_${language} as "flatName", f.floor, b.name_${language} as "buildingName", l.name_${language} as "localityName", c.name_${language} as "cityName" from flats f
    join buildings b on f."buildingId" = b.id
    join localities l on l.id = b."localityId"
    join cities c on c.id = l."cityId"
    where f.id = :id and f."deletedAt" is null
  `,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          id: params.id,
        },
      }
    )
  )[0];

  return `${
    flatLocation.floor ? "Floor no. " + flatLocation.floor + "," : ""
  } Flat no. ${flatLocation.flatName}, ${flatLocation.buildingName}, ${
    flatLocation.localityName
  }, ${flatLocation.cityName}`;
}

function getFlatWithBuilding(params, language = LANGUAGES.EN) {
  return Flat.scope("languageHelper").findOne({
    where: params,
    attributes: { include: Object.entries(FLAT_LANGUAGE_VARS[language]) },
    include: {
      model: Building,
      as: "building",
      required: true,
      attributes: {
        exclude: BUILDING_LANGUAGE_KEYS,
        include: Object.entries(BUILDING_LANGUAGE_VARS[language]),
      },
    },
  });
}

async function getFlatWithLocality(params = {}, language = LANGUAGES.EN) {
  return await Flat.scope("languageHelper").findOne({
    where: params,
    attributes: { include: Object.entries(FLAT_LANGUAGE_VARS[language]) },
    include: {
      model: Building,
      as: "building",
      attributes: {
        exclude: BUILDING_LANGUAGE_KEYS,
        include: Object.entries(BUILDING_LANGUAGE_VARS[language]),
      },
      include: {
        model: Locality,
        as: "locality",
        attributes: {
          exclude: LOCALITY_LANGUAGE_KEYS,
          include: Object.entries(LOCALITY_LANGUAGE_VARS[language]),
        },
      },
    },
  });
}

//TODO: REMOVE FLAT CONTRACTS MAPPING
//get all flats
const countAndGetFlats = async (
  params,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  // enableSearch(params, "name", language);
  if (params.search) {
    params[Op.or] = [
      { [`name_${language}`]: { [Op.iLike]: `%${params.search}%` } },
      { [`$building.name_${language}$`]: { [Op.iLike]: `%${params.search}%` } },
      { floor: { [Op.iLike]: `%${params.search}%` } },
      { size: { [Op.iLike]: `%${params.search}%` } },
      { "$owner.name$": { [Op.iLike]: `%${params.search}%` } },
      db.sequelize.literal(
        `cast("flatInfo".bedroom as VARCHAR) ilike ` + `'%${params.search}%'`
      ),
      db.sequelize.literal(
        `cast("flatInfo".bathroom as VARCHAR) ilike ` + `'%${params.search}%'`
      ),
    ];
  }
  delete params.search;
  const flats = await Flat.findAndCountAll({
    where: params,
    attributes: [
      "id",
      "name_en",
      "name_ar",
      "floor",
      "size",
      "flatType",
      "buildingId",
    ],
    include: [
      {
        model: FlatInformation,
        as: "flatInfo",
        required: false,
        attributes: ["bedroom", "bathroom"],
      },
      {
        model: FlatContract,
        as: "contractDetails",
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "isExpired",
          "contractStartDate",
          "contractEndDate",
          "isValid",
          "grace",
        ],
        limit: 1,
        required: false,
      },
      {
        model: Building,
        as: "building",
        required: false,
        attributes: ["name_en", "name_ar"],
      },
      {
        model: MasterUser,
        as: "owner",
        attributes: ["id", "name", "mobileNumber", "countryCode", "email"],
      },
    ],
    order: [
      ["floor", "ASC"],
      [`name_${language}`, "ASC"],
    ],
    offset,
    limit,
  });

  const flatsResponse = JSON.parse(JSON.stringify(flats));

  if (flatsResponse.rows && flatsResponse.rows.length) {
    flatsResponse.rows.forEach((flat) => {
      flat.contractPeriod = null;
      if (
        flat.contractDetails &&
        flat.contractDetails.length &&
        !flat.contractDetails[0].isExpired
      ) {
        const { contractStartDate, contractEndDate } = flat.contractDetails[0];
        const monthsDifferenceForTimePeriod = parseFloat(
          moment(contractEndDate).diff(moment(contractStartDate), "months")
        ).toPrecision(2);
        const yearsDifferenceForTimePeriod = parseFloat(
          moment(contractEndDate).diff(moment(contractStartDate), "years")
        ).toPrecision(2);

        if (monthsDifferenceForTimePeriod < 1) {
          flat.contractPeriod = `${daysDifferenceForTimePeriod} days`;
        }
        if (monthsDifferenceForTimePeriod > 1) {
          flat.contractPeriod = `${monthsDifferenceForTimePeriod} months`;
        }
        if (yearsDifferenceForTimePeriod >= 1) {
          flat.contractPeriod = `${yearsDifferenceForTimePeriod} years`;

          if (
            yearsDifferenceForTimePeriod -
              Math.floor(yearsDifferenceForTimePeriod) ===
            0
          ) {
            const period =
              Math.floor(yearsDifferenceForTimePeriod) > 1 ? "years" : "year";
            flat.contractPeriod = `${Math.floor(
              yearsDifferenceForTimePeriod
            )} ${period}`;
          }
        }
      }
    });
  }
  return flatsResponse;
};

//get all flats
const countAndGetFlatsWithFilters = async (
  params,
  propertyId,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  const query = `
    SELECT f.id, f.name_en, f.size, f."flatType", f."buildingId", b.id AS "building.id", b.name_en AS "building.name_en",
    mu.id AS "owner.id", mu.name AS "owner.name",
    case
      when l.status = :activeLeaseStatus then '${CONTRACT_STATUSES.ACTIVE}'
      when l.id is null then null
      else '${CONTRACT_STATUSES.IN_ACTIVE}'
    end as "leaseStatus",
    case
      when l.status = :activeLeaseStatus then '${FLAT_STATUSES.OCCUPIED}'
      else '${FLAT_STATUSES.VACANT}'
    end as "flatStatus",
    CASE WHEN l.status = :activeLeaseStatus THEN ROUND((EXTRACT(epoch FROM (l."endDate" - l."startDate")))/(3600*24*30)) ELSE NULL END AS period,
    COUNT(f.*) OVER () as "count"
    FROM "flats" f 
    join "flat_informations" fi on fi."flatId" = f.id and (fi."deletedAt" IS NULL)
    left join (
      select distinct on(l1."flatId") l1.id, l1."flatId", ls.status, l1."startDate", l1."endDate" from leases l1
      join lease_statuses ls on (ls."leaseId" = l1.id AND ls."deletedAt" is null)
      where l1."deletedAt" is null order by l1."flatId", l1."createdAt" desc, ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    JOIN "buildings" b ON f."buildingId" = b.id AND (b."deletedAt" IS NULL)
    LEFT JOIN "master_users" mu ON f."ownerId" = mu."id" AND (mu."deletedAt" IS NULL)
    WHERE f."deletedAt" IS NULL AND b."propertyId" = :propertyId ${
      params.buildingId ? `AND f."buildingId" = '${params.buildingId}'` : ``
    } ${
    params.contractStatus
      ? `AND ${
          params.contractStatus === CONTRACT_STATUSES.ACTIVE
            ? `l.status = :activeLeaseStatus`
            : `(l.id is null or l.status in (:inActiveLeaseStatuses))`
        } `
      : ``
  } ${params.flatType ? `AND  f."flatType" = '${params.flatType}'` : ``} 
  ${params.ownerIds ? `AND f."ownerId" in (:ownerIds)` : ``}
  ${params.furnishing ? `AND fi."furnishing" = '${params.furnishing}'` : ``}
  ${params.flatIds ? `AND f.id in (:flatIds)` : ``}
  ${params.rentalType ? `AND fi."rentalType" = '${params.rentalType}'` : ``}
  ${
    params.search
      ? `and (f.name_en ilike '%${params.search}%' OR b.name_en ilike '%${params.search}%' OR f."flatType" ilike '%${params.search}%' OR f.size ilike '%${params.search}%' OR mu.name ilike '%${params.search}%')`
      : ""
  } ORDER BY f."createdAt" DESC,f."name_en" ASC LIMIT :limit OFFSET :offset`;

  const replacements = {
    offset,
    limit,
    propertyId,
    inActiveLeaseStatuses: new Array(
      LEASE_STATUSES.CANCELLED,
      LEASE_STATUSES.EXPIRED,
      LEASE_STATUSES.TERMINATED
    ),
    activeLeaseStatus: LEASE_STATUSES.ACTIVE,
    flatIds: params.flatIds,
    ownerIds: params.ownerIds,
  };

  const flats = await db.sequelize.query(query, {
    replacements,
    nest: true,
    raw: true,
    type: db.sequelize.QueryTypes.SELECT,
  });
  const count = flats[0]?.count ? parseInt(flats[0]?.count) : 0;

  return { count, rows: flats };
};

//TODO: REMOVE FLAT CONTRACTS MAPPING
//get flat details - to be viewed by admin
const getFlatDetails = async (params) => {
  params["$building.propertyId$"] = params.propertyId;
  delete params.propertyId;

  const [flat, tenantDetails] = await Promise.all([
    Flat.findOne({
      where: params,
      include: [
        {
          model: FlatInformation,
          as: "flatInfo",
          attributes: [
            "bedroom",
            "bathroom",
            "furnishing",
            "primaryContact",
            "poaDetails",
            "parkingLots",
            "accessCards",
            "leaseType",
            "rentalType",
          ],
          required: true,
        },
        {
          model: Building,
          as: "building",
          required: true,
          attributes: ["id", "name_en"],
        },
        {
          model: MasterUser,
          as: "owner",
          attributes: ["id", "name", "countryCode", "mobileNumber", "email"],
          required: false,
        },
      ],
    }),
    getTenantDetailsFromLease({ flatId: params.id }),
  ]);
  if (!flat) {
    throw new AppError("getFlatDetails", "Flat not found", "custom", 404);
  }

  flat.setDataValue("tenantDetails", tenantDetails);

  return flat;
};

//remove owner from flat
const removeOwner = async (params) => {
  const owner = await getMasterUser(params);
  if (!owner) {
    throw new AppError("removeOwner", "Owner not found", "custom", 404);
  }
  const flat = await Flat.findOne({ where: { ownerId: owner.id } });
  if (!flat) {
    throw new AppError(
      "removeOwner",
      "Flat not found for this owner",
      "custom",
      404
    );
  }
  await flat.update({ ownerId: null });
  await FlatInformation.update(
    { purchasePrice: null, purchaseDate: null, purchaseCurrency: null },
    { where: { flatId: flat.id } }
  );
  return;
};

//add owner to flat
const addOwner = async ({
  ownerId,
  flatId,
  propertyId,
  purchaseDate,
  purchaseCurrency,
  purchasePrice,
}) => {
  const reference = "addOwner";

  let isOwnerCreated = false;
  let password = null;

  const [flat, user] = await Promise.all([
    getFlatWithBuilding({
      id: flatId,
      "$building.propertyId$": propertyId,
    }),
    getMasterUser({ id: ownerId, propertyId }),
  ]);

  if (!flat) {
    throw new AppError(reference, "Flat not found", "custom", 404);
  }
  if (!user) {
    throw new AppError(reference, "Owner not found", "custom", 404);
  }

  if (flat.ownerId) {
    throw new AppError(reference, "An owner already exists", "custom", 412);
  }

  const flatInfoData = {};
  if (purchaseDate) {
    flatInfoData.purchaseDate = purchaseDate;
  }
  if (purchaseCurrency) {
    flatInfoData.purchaseCurrency = purchaseCurrency;
  }
  purchasePrice && (flatInfoData.purchasePrice = purchasePrice);

  const transaction = await db.sequelize.transaction();
  try {
    const findOwner = await getOwner({ mobileNumber: user.mobileNumber });

    flat.ownerId = ownerId;

    const promisesArray = [
      flat.save({ transaction }),
      FlatInformation.update(flatInfoData, {
        where: { flatId: flat.id },
        transaction,
      }),
    ];

    if (!findOwner) {
      isOwnerCreated = true;
      password = generatePassword();
      const newOwnerData = {
        name: user.name,
        email: user.email,
        countryCode: user.countryCode,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture ? user.profilePicture : null,
        password: await hashPassword(password),
      };
      logger.info(
        `Password created for owner - ${user.mobileNumber} : ${password}`
      );
      promisesArray.push(createOwner(newOwnerData, transaction));
    }
    const ownerFlatData = {
      masterUserId: user.id,
      flatId,
    };
    promisesArray.push(createOwnerFlat(ownerFlatData, transaction));

    await Promise.all(promisesArray);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  //send email to respective parties
  if (isOwnerCreated) {
    //send email to owner with new credentials
  } else {
    //send email notifying owner of a newly added flat
  }

  const responseObj = {
    id: user.id,
    countryCode: user.countryCode,
    mobileNumber: user.mobileNumber,
    email: user.email,
  };

  return responseObj;
};

async function getFlatCount(flatParams) {
  return await Flat.findOne({
    where: flatParams,
    attributes: [
      [db.sequelize.fn("count", db.sequelize.col("Flat.id")), "totalFlats"],
    ],
    raw: true,
    include: {
      model: Building,
      as: "building",
      attributes: [],
      required: true,
    },
  });
}

async function getFlatsWithResident(params) {
  return await Flat.findAll({
    where: params,
    raw: true,
    include: {
      model: User,
      as: "user",
      attributes: [],
      required: true,
    },
  });
}

async function getFlatOwnerDetails(params) {
  const flat = await Flat.findOne({
    attributes: ["id", "ownerId", "amenities"],
    where: params,
    include: [
      {
        model: MasterUser,
        required: false,
        as: "owner",
        attributes: [
          "id",
          "name",
          "email",
          "profilePicture",
          "mobileNumber",
          "countryCode",
        ],
      },
      {
        model: FlatInformation,
        required: true,
        as: "flatInfo",
        attributes: ["accessCards", "parkingLots"],
      },
    ],
  });
  if (!flat) {
    throw new AppError("getFlatOwnerDetails", "Flat not found", "custom", 404);
  }

  return flat;
}

async function getAllFlats(params) {
  if (params.buildingId) {
    params["$building.id$"] = params.buildingId;
  }

  if (params.search) {
    params[Op.or] = [
      { "$Flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  params["$building.propertyId$"] = params.propertyId;

  delete params.buildingId;
  delete params.propertyId;
  delete params.search;

  return await Flat.findAndCountAll({
    where: params,
    attributes: ["id", "name_en", "name_ar"],
    order: [["name_en", "ASC"]],
    include: {
      model: Building,
      as: "building",
      attributes: [],
      required: true,
    },
  });
}

async function updateOwner({ masterUserId, propertyId, flatId }) {
  const reference = "updateOwner";
  if (!masterUserId || !flatId) {
    throw new AppError(reference, "User Id is required", "custom", 412);
  }
  const [owner, flat] = await Promise.all([
    getMasterUser({ id: masterUserId, propertyId }),
    Flat.findOne({
      where: {
        "$building.propertyId$": propertyId,
      },
      include: {
        model: Building,
        as: "building",
        attributes: [],
      },
    }),
  ]);

  if (!flat) {
    throw new AppError(reference, "Flat not found", "custom", 404);
  }
  if (!owner) {
    throw new AppError(reference, "Owner not found", "custom", 404);
  }
  await Flat.update({ ownerId: owner.id }, { where: { id: flatId } });
  return "Owner updated successfully";
}

async function deleteFlat(params) {
  const reference = "deleteFlat";
  const [flat, lease] = await Promise.all([
    getFlatDetails(params),
    // getLeaseWithLatestStatus({ flatId: params.id }), Circular Dependency
    Lease.findOne({
      where: { flatId: params.id },
      include: [
        {
          model: LeaseStatus,
          as: "statuses",
          required: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
      ],
    }),
  ]);

  if (flat.owner) {
    throw new AppError(
      reference,
      "An owner exists in this flat",
      "custom",
      412
    );
  }
  if (lease) {
    throw new AppError(reference, "Lease exists for this unit", "custom", 412);
  }
  await Flat.destroy({ where: { id: flat.id } });
  return null;
}

//TODO: REMOVE FLAT CONTRACTS MAPPING
const getFlatsInPropertyForExport = async (params) => {
  const reference = `getFlatsInPropertyForExport`;

  const query = `
    SELECT f.name_en, f.floor, f.size, f."flatType", fi.bedroom AS "flatInfo.bedroom", fi.bathroom AS "flatInfo.bathroom", 
    b.name_en AS "building.name_en", mu.name AS "owner.name", l."startDate"::date,
    (l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)) AS "contractEndDate",
	  CASE WHEN l."status" in (:activeStatuses)  then '${
      CONTRACT_STATUSES.ACTIVE
    }' else '${CONTRACT_STATUSES.IN_ACTIVE}' end as "leaseStatus",
	  case when l."status" in (:activeStatuses) then '${
      FLAT_STATUSES.OCCUPIED
    }' else '${FLAT_STATUSES.VACANT}' end as "flatStatus",
       (
        CASE
            WHEN l."status" IN (:activeStatuses) THEN
                ROUND((EXTRACT(epoch FROM (l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) - l."startDate")))/(3600*24*30))
        END
    ) AS period
    FROM "flats" f 
    JOIN "flat_informations" fi on fi."flatId" = f.id and (fi."deletedAt" IS NULL)
     left join (
      select distinct on(l."flatId") l.id, l."flatId", ls.status,l."endDate",l."startDate",l.discount from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc, ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    JOIN "buildings" b ON f."buildingId" = b.id AND (b."deletedAt" IS NULL)
    LEFT JOIN "master_users" mu ON f."ownerId" = mu."id" AND (mu."deletedAt" IS NULL)
    WHERE f."deletedAt" IS NULL AND b."propertyId" = :propertyId
    ${params.buildingId ? `AND f."buildingId" = '${params.buildingId}'` : ``}
    ${
      params.contractStatus
        ? `AND ${
            params.contractStatus === CONTRACT_STATUSES.ACTIVE
              ? `l."status" in (:activeStatuses)`
              : `l."status" in (:inActiveStatuses)`
          } `
        : ``
    }
    ${params.flatType ? `AND f."flatType" = '${params.flatType}'` : ``}
    ${
      params.search
        ? `and (
            f.name_en ilike '%${params.search}%' OR
            b.name_en ilike '%${params.search}%' OR
            f."flatType" ilike '%${params.search}%' OR
            f.size ilike '%${params.search}%' OR
            mu.name ilike '%${params.search}%'
          )`
        : ""
    } ORDER BY  f.name_en ASC`;

  const replacements = {
    propertyId: params.propertyId,
    inActiveStatuses: new Array(
      LEASE_STATUSES.CANCELLED,
      LEASE_STATUSES.EXPIRED,
      LEASE_STATUSES.TERMINATED
    ),
    activeStatuses: new Array(LEASE_STATUSES.ACTIVE),
  };

  const flats = await db.sequelize.query(query, {
    replacements,
    nest: true,
    raw: true,
    type: db.sequelize.QueryTypes.SELECT,
  });

  return flats;
};

const totalFlatCount = async (startDate, endDate, propertyId, buildingId) => {
  // startDate = new Date(startDate);
  // endDate = new Date(endDate);
  startDate = moment(startDate).startOf("day").toDate();
  endDate = moment(endDate).endOf("day").toDate();
  let result;
  const timeDifference = Math.abs(endDate - startDate);

  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const thirtyDays = 30 * oneDay;
  const oneYear = 365 * oneDay;
  if (timeDifference <= oneDay) {
    const query = `SELECT COUNT(*) AS count,
       TO_CHAR(DATE_TRUNC('hour', flats."createdAt"::timestamp)
       - (DATE_PART('hour', flats."createdAt"::timestamp)::integer % 3) * interval '1 hour', 'HH24:MI')
       || '-'
       || TO_CHAR(DATE_TRUNC('hour', flats."createdAt"::timestamp)
       - (DATE_PART('hour', flats."createdAt"::timestamp)::integer % 3) * interval '1 hour' + interval '3 hours', 'HH24:MI') AS date_time_range
    FROM flats INNER JOIN "buildings" AS "building" ON flats."buildingId" = "building"."id" AND ("building"."deletedAt" IS NULL AND "building"."propertyId" = '${propertyId}' 
    ${buildingId ? `AND flats."buildingId"='${buildingId}'` : ""})
    where flats."createdAt" between  '${startDate.toISOString()}' AND  '${endDate.toISOString()}'
    GROUP BY date_time_range
    ORDER BY date_time_range ASC;`;
    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
    });
  } else if (timeDifference <= oneWeek) {
    const query = `SELECT
  CASE
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 0 THEN 'Sun'
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 1 THEN 'Mon'
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 2 THEN 'Tue'
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 3 THEN 'Wed'
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 4 THEN 'Thu'
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 5 THEN 'Fri'
    WHEN EXTRACT(DOW FROM flats."createdAt"::timestamp AT TIME ZONE 'UTC') = 6 THEN 'Sat'
  END AS day_of_week,
  COUNT(*) AS count
  FROM
    flats
  INNER JOIN
    "buildings" AS "building"
    ON flats."buildingId" = "building"."id"
    AND ("building"."deletedAt" IS NULL AND "building"."propertyId" = '${propertyId}' ${
      buildingId ? `AND flats."buildingId"='${buildingId}'` : ""
    } )
  WHERE
    flats."createdAt" BETWEEN  '${startDate.toISOString()}' AND  '${endDate.toISOString()}'
  GROUP BY
    day_of_week
  ORDER BY
    day_of_week ASC`;

    result = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
    });
  } else if (timeDifference <= thirtyDays) {
    const query = `SELECT
  COUNT(*) AS count,
  TO_CHAR(DATE_TRUNC('week', flats."createdAt"::timestamp AT TIME ZONE 'UTC'), 'MM/DD')
  || '-'
  || TO_CHAR(DATE_TRUNC('week', flats."createdAt"::timestamp AT TIME ZONE 'UTC') + INTERVAL '6 days', 'MM/DD') AS week_date_range
  FROM
    flats
  INNER JOIN
    "buildings" AS "building"
    ON flats."buildingId" = "building"."id"
    AND ("building"."deletedAt" IS NULL AND "building"."propertyId" = '${propertyId}' ${
      buildingId ? `AND flats."buildingId"='${buildingId}'` : ""
    })
  WHERE
    flats."createdAt" BETWEEN  '${startDate.toISOString()}' AND  '${endDate.toISOString()}'
  GROUP BY
    week_date_range
  ORDER BY
    week_date_range ASC;`;

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
    let flats = await Flat.count({
      attributes: [
        [
          db.sequelize.fn(
            "EXTRACT",
            db.sequelize.literal(`YEAR FROM ("Flat"."createdAt")`)
          ),
          "year",
        ],
        [
          db.sequelize.fn(
            "EXTRACT",
            db.sequelize.literal(`MONTH FROM ("Flat"."createdAt")`)
          ),
          "month",
        ],
        [db.sequelize.fn("COUNT", db.sequelize.col(`"Flat"."id"`)), "count"],
      ],
      include: {
        model: Building,
        as: "building",
        where: params,
      },
      raw: true,
      where: {
        createdAt: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      group: ["year", "month"],
    });
    const flatsMap = new Map();
    flats.forEach((flat) => {
      const year = flat.year;
      const month = flat.month;
      flatsMap.set(`${year}-${month}`, flat);
    });

    result = monthsInRange.map(({ year, month }) => {
      const key = `${year}-${month}`;
      const flatData = flatsMap.get(key) || { year, month, count: 0 };
      return flatData;
    });
  }
  return result;
};

const getFlatIncludingBuilding = async (params, scope = null) => {
  return await Flat.scope(scope).findOne({
    where: params,
    include: [
      {
        model: Building,
        as: "building",
        attributes: [],
        required: true,
      },
    ],
  });
};

module.exports = {
  getFlats,
  addFlat,
  getFlat,
  getFlatWithCityAndCountry,
  getFlatAddress,
  getFlatWithBuilding,
  getFlatWithLocality,
  countAndGetFlats,
  getFlatDetails,
  removeOwner,
  addOwner,
  getFlatCount,
  getFlatsWithResident,
  getFlatOwnerDetails,
  getAllFlats,
  updateOwner,
  deleteFlat,
  getFlatsInPropertyForExport,
  totalFlatCount,
  countAndGetFlatsWithFilters,
  getFlatIncludingBuilding,
};
