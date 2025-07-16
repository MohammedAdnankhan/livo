const { Op } = require("sequelize");
const { getBuildings } = require("../../building-service/controllers/building");
const Building = require("../../building-service/models/Building");
const City = require("../../city-service/models/City");
const { LANGUAGES, GUARD_STATUSES } = require("../../config/constants");
const db = require("../../database");
const Locality = require("../../locality-service/models/Locality");
const { AppError } = require("../../utils/errorHandler");
const Guard = require("../models/Guard");
const GuardBuilding = require("../models/GuardBuilding");

async function updateGuardDetails(params, guardDetails) {
  await Guard.update(guardDetails, { where: params });
}

const getGuardsOfProperty = async (params, { offset, limit }) => {
  const reference = `getGuardsOfProperty`;
  if (params.search) {
    params[Op.or] = [
      { name: { [Op.iLike]: `%${params.search}%` } },
      { userName: { [Op.iLike]: `%${params.search}%` } },
      { countryCode: { [Op.iLike]: `%${params.search}%` } },
      { mobileNumber: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  if (params.status && !Object.values(GUARD_STATUSES).includes(params.status)) {
    throw new AppError(
      reference,
      `Guard status can only be ${Object.values(GUARD_STATUSES).join(", ")}`,
      "custom",
      412
    );
  }
  if (params.status) {
    if (params.status === GUARD_STATUSES.ACTIVE) {
      params.isActive = true;
    }
    if (params.status === GUARD_STATUSES.IN_ACTIVE) {
      params.isActive = false;
    }
  }
  delete params.status;

  const guards = await Guard.findAll({
    distinct: true,
    where: params,
    order: [["createdAt", "DESC"]],
    attributes: {
      include: [
        [db.sequelize.literal(`COUNT (*) OVER ()`), "count"],
        "createdAt",
      ],
      exclude: ["propertyId"],
    },
    include: [
      {
        model: GuardBuilding,
        as: "guardBuildings",
        required: false,
        include: {
          model: Building,
          required: false,
          where: { propertyId: params.propertyId },
          as: "building",
          attributes: ["name_en", "name_ar"],
        },
      },
    ],
    limit,
    offset,
  });
  const count = guards[0]?.get("count");
  return {
    count: count ? +count : 0,
    rows: guards,
  };
};

const updateGuard = async (params, data) => {
  const reference = "updateGuard";
  const guard = await getGuard(params);
  if (!guard) {
    throw new AppError(reference, "Guard not found", "custom", 404);
  }
  delete data.id;
  delete data.isActive;
  delete data.propertyId;

  const guardId = guard.id;

  if (
    data.userName &&
    (await getGuard({
      userName: data.userName,
      id: { [Op.ne]: guard.id },
    }))
  ) {
    throw new AppError(
      reference,
      "Mentioned user name already exists",
      "custom",
      412
    );
  }

  if (
    data.mobileNumber &&
    (await getGuard({
      mobileNumber: data.mobileNumber,
      id: { [Op.ne]: guard.id },
    }))
  ) {
    throw new AppError(
      reference,
      "Mentioned mobile number already exists",
      "custom",
      412
    );
  }

  guard.name = data.name || guard.name;
  guard.mobileNumber = data.mobileNumber || guard.mobileNumber;
  // guard.profilePicture = data.profilePicture || guard.profilePicture;
  if ("profilePicture" in data) {
    guard.profilePicture = data.profilePicture;
  }
  guard.company = data.company || guard.company;
  guard.documentType = data.documentType || guard.documentType;
  guard.documentId = data.documentId || guard.documentId;
  guard.countryCode = data.countryCode || guard.countryCode;
  guard.documents = data.documents || guard.documents;
  guard.nationality = data.nationality || guard.nationality;
  guard.password = data.password || guard.password;
  guard.alternateContact.countryCode =
    data.alternateCountryCode || guard.alternateContact.countryCode;
  guard.alternateContact.mobileNumber =
    data.alternateMobileNumber || guard.alternateContact.mobileNumber;
  guard.alternateContact.email =
    data.alternateEmail || guard.alternateContact.email;
  guard.pocContact.countryCode =
    data.pocCountryCode || guard.pocContact.countryCode;
  guard.pocContact.mobileNumber =
    data.pocMobileNumber || guard.pocContact.mobileNumber;
  guard.pocContact.email = data.pocEmail || guard.pocContact.email;

  if (data.buildings) {
    const buildingsToKeep = [];
    if (
      (
        await getBuildings({
          id: {
            [Op.in]: data.buildings,
          },
          propertyId: params.propertyId,
        })
      )?.length != data.buildings.length //TODO: optimize - create count function and validate directly
    ) {
      throw new AppError(
        reference,
        "Selected building not found",
        "custom",
        412
      );
    }
    await Promise.all(
      data.buildings.map(async (buildingId) => {
        const [guardBuilding, created] =
          await GuardBuilding.unscoped().findOrCreate({
            where: {
              guardId,
              buildingId,
            },
            paranoid: false,
          });
        if (!created && guardBuilding.deletedAt) {
          await guardBuilding.restore();
        }
        buildingsToKeep.push(buildingId);
      })
    );
    await GuardBuilding.destroy({
      where: {
        guardId,
        buildingId: {
          [Op.notIn]: buildingsToKeep,
        },
      },
    });
  }
  guard.changed("alternateContact", true);
  guard.changed("pocContact", true);
  await guard.save();
  return guard;
};

const getGuardDetails = async (params) => {
  const guard = await Guard.findOne({
    where: params,
    include: [
      {
        model: GuardBuilding,
        as: "guardBuildings",
        include: {
          model: Building,
          as: "building",
          attributes: ["id", `name_en`, "name_ar"],
        },
      },
    ],
  });
  if (!guard) {
    throw new AppError("getGuardDetails", "Guard not found", "custom", 404);
  }
  return guard;
};

async function getGuard(params) {
  return await Guard.findOne({ where: params });
}

async function getGuardBuildings(
  { guardId, propertyId },
  language = LANGUAGES.EN
) {
  const response = [];
  const guardBuildings = await GuardBuilding.findAll({
    where: { guardId },
    include: {
      model: Building,
      as: "building",
      where: { propertyId },
      attributes: [
        "id",
        "name_en",
        "name_ar",
        "images",
        "address_en",
        "address_ar",
        "buildingType",
        "description_en",
        "description_ar",
      ],
      include: {
        model: Locality,
        as: "locality",
        attributes: ["id", "name_en", "name_ar"],
        include: {
          model: City,
          as: "city",
          attributes: ["id", "name_en", "name_ar", "country_en", "country_ar"],
        },
      },
    },
  });
  if (guardBuildings.length) {
    guardBuildings.map(({ building }) => {
      response.push({
        id: building.id,
        name: building[`name_${language}`],
        images: building.images,
        buildingType: building.buildingType,
        address: building[`address_${language}`],
        // description: building[`description_${language}`],
        locality: building["locality"][`name_${language}`],
        city: building["locality"]["city"][`name_${language}`],
        country: building["locality"]["city"][`country_${language}`],
      });
    });
  }
  return response;
}

async function getGuardBuilding(params) {
  return await GuardBuilding.findOne({
    where: params,
  });
}

async function getGuardsOfBuilding(params, { offset, limit }) {
  const reference = `getGuardsOfBuilding`;
  if (params.search) {
    params[Op.or] = [
      { name: { [Op.iLike]: `%${params.search}%` } },
      { userName: { [Op.iLike]: `%${params.search}%` } },
      { countryCode: { [Op.iLike]: `%${params.search}%` } },
      { mobileNumber: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  if (params.status && !Object.values(GUARD_STATUSES).includes(params.status)) {
    throw new AppError(
      reference,
      `Guard status can only be ${Object.values(GUARD_STATUSES).join(", ")}`,
      "custom",
      412
    );
  }
  if (params.status) {
    if (params.status === GUARD_STATUSES.ACTIVE) {
      params.isActive = true;
    }
    if (params.status === GUARD_STATUSES.IN_ACTIVE) {
      params.isActive = false;
    }
  }
  delete params.status;
  const buildingId = params.buildingId;
  delete params.buildingId;
  const guards = await Guard.findAndCountAll({
    distinct: true,
    offset,
    limit,
    where: params,
    include: [
      {
        model: GuardBuilding,
        as: "guardBuildings",
        where: { buildingId },
        include: {
          model: Building,
          as: "building",
          attributes: ["id", "name_en", "name_ar"],
        },
      },
    ],
  });
  return guards;
}

async function getGuardFlats(params, language = LANGUAGES.EN) {
  const query = `
  select f.id, f.name_${language} as name, f.floor, f."flatType", b.name_en, b.id as "buildingId" from flats f
  join buildings b on (b.id = f."buildingId" and b."deletedAt" is null and b."propertyId" = :propertyId)
  join guard_buildings gb on (gb."buildingId" = b.id and gb."deletedAt" is null and gb."guardId" = :guardId)
  where f."deletedAt" is null ${
    params.buildingId ? `and b.id = '${params.buildingId}'` : ""
  } and f.name_${language} ilike :nameRegex
  order by
  CASE
    WHEN f."floor" ~ '^[0-9]+$' then f."floor"::integer
    ELSE (select count(*) from flats)
  END, 
  CASE 
    WHEN f.name_en ~ '^[0-9]+$' then f.name_en::integer
    ELSE (select count(*) from flats)
  END ASC`;
  return await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      guardId: params.guardId,
      nameRegex: params.search ? `%${params.search}%` : "%",
    },
  });
}

async function updateGuardStatus({ id, propertyId }) {
  const reference = "updateGuardStatus";
  const params = { id, propertyId };
  const guard = await getGuard(params);
  if (!guard) {
    throw new AppError(reference, "Guard not found", "custom", 404);
  }
  const { isActive } = guard;
  guard.isActive = !isActive;

  await guard.save();
  return { isActive: guard.isActive };
}

const getCompaniesDropdown = async (propertyId) => {
  const companies = await Guard.findAll({
    where: { propertyId, company: { [Op.not]: null } },
    attributes: [
      [db.Sequelize.fn("DISTINCT", db.Sequelize.col("company")), "company"],
    ],
    raw: true,
  });
  const companyNames = companies.map((entry) => entry.company);

  return companyNames;
};

const getGuardExports = async (params) => {
  const query = `SELECT DISTINCT ON (g."createdAt",g."documentId")  
  g.name, g."userName", g."countryCode", g."mobileNumber", g."profilePicture", g."gender",
  g."alternateContact", g."pocContact", g."nationality", g."documentType",
  g."documentId", g."documents", g.company, 
  b.name_en as "buildingName",
  CASE WHEN g."isActive" is true THEN 'Active' ELSE 'In-Active' END AS "status"
FROM guards g 
  INNER JOIN guard_buildings gb ON (gb."guardId" = g.id AND gb."deletedAt" IS NULL)
  INNER JOIN buildings b ON (b.id = gb."buildingId" AND gb."deletedAt" IS NULL)
WHERE g."deletedAt" IS NULL
 ${
   params.buildingId
     ? `AND  b.id = '${params.buildingId}' AND  b."propertyId" = '${params.propertyId}'`
     : `AND  b."propertyId" ='${params.propertyId}'`
 }
${
  params.status
    ? params.status === GUARD_STATUSES.ACTIVE
      ? `AND g."isActive" = true`
      : `AND g."isActive" = false`
    : ""
}
 ${
   params.search
     ? ` AND (g.name ILIKE '%${params.search}%' OR
          g."userName" ILIKE '%${params.search}%' OR 
          g."countryCode" ILIKE '%${params.search}%' OR
          g."mobileNumber" ILIKE '%${params.search}%')`
     : ""
 }
 ${params.company ? `AND g.company ='${params.company}'` : ""}
ORDER BY g."createdAt" DESC, g."documentId"
`;
  return await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
  });
};

const getActiveLoggedInGuards = async ({ buildingIds, startDate, endDate }) => {
  const query = `select count(*)::INTEGER from guards g
INNER join guard_buildings gb ON (g.id = gb."guardId" and gb."deletedAt" is null)
WHERE g."deletedAt" is null AND g."lastLogin" is not null AND g."isActive" = true
AND gb."buildingId" in (:buildingIds) AND g."lastLogin" between :startDate and :endDate`;

  const activeGuards = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingIds,
      startDate,
      endDate,
    },
  });
  return activeGuards[0].count;
};

module.exports = {
  getGuardsOfProperty,
  getGuardDetails,
  updateGuard,
  updateGuardDetails,
  getGuard,
  getGuardBuildings,
  getGuardBuilding,
  getGuardsOfBuilding,
  getGuardFlats,
  updateGuardStatus,
  getCompaniesDropdown,
  getGuardExports,
  getActiveLoggedInGuards,
};
