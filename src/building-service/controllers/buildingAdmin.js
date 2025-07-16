const {
  LANGUAGES,
  BUILDING_TYPES,
  LEASE_STATUSES,
} = require("../../config/constants");
const Locality = require("../../locality-service/models/Locality");
const City = require("../../city-service/models/City");
const { AppError } = require("../../utils/errorHandler");
const { enableSearch } = require("../../utils/utility");
const Building = require("../models/Building");
const { getBuildingWithCityAndLocality, getBuilding } = require("./building");
const { Op } = require("sequelize");
const Flat = require("../../flat-service/models/Flat");
const db = require("../../database");
const { getLocality } = require("../../locality-service/controllers/locality");

const addBuilding = async (data = {}) => {
  const reference = "addBuilding";
  if (!data.localityId) {
    throw new AppError(reference, "Locality Id is required", "custom", 412);
  }
  if (data.location) {
    if (!Array.isArray(data.location) || data.location.length !== 2) {
      throw new AppError(reference, "Enter valid location", "custom", 412, [
        {
          column: "location",
          message: "Enter valid location",
        },
      ]);
    }
    data.location = {
      //TODO: do not mutate the data being passed in func args
      type: "Point",
      coordinates: data.location,
    };
  }
  if (
    data.buildingType &&
    !Object.values(BUILDING_TYPES).includes(data.buildingType)
  ) {
    throw new AppError(
      reference,
      `Building type can only be ${Object.values(BUILDING_TYPES).join(", ")}`,
      "custom",
      412
    );
  }
  data.primaryContact = {
    name: data.contactName ? data.contactName : null,
    countryCode: data.contactCountryCode ? data.contactCountryCode : null,
    mobileNumber: data.contactMobileNumber ? data.contactMobileNumber : null,
    email: data.contactEmail ? data.contactEmail : null,
  };
  //validate if same building with property Id exists
  const [buildingInProperty, locality] = await Promise.all([
    Building.findOne({
      where: {
        name_en: data.name_en,
        propertyId: data.propertyId,
      },
    }),
    getLocality({ id: data.localityId }),
  ]);
  if (buildingInProperty) {
    throw new AppError(
      reference,
      "Building with mentioned name already exists",
      "custom",
      412
    );
  }

  if (!locality) {
    throw new AppError(reference, "Locality not found", "custom", 404);
  }

  //validate if building with same govId exists when it is coming in payload
  if (data.governmentPropertyId) {
    const buildingFromGovId = await Building.findOne({
      where: {
        governmentPropertyId: data.governmentPropertyId,
        propertyId: data.propertyId,
      },
    });
    if (buildingFromGovId) {
      throw new AppError(
        reference,
        "Building with mentioned government Id already exists",
        "custom",
        412
      );
    }
  }
  let building = null;
  try {
    building = await Building.create(data);
  } catch (error) {
    building = await Building.findOne({
      where: {
        name_en: data.name_en,
        propertyId: data.propertyId,
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });
    if (!building) {
      throw error;
    }

    for (const key in building.get({ plain: true })) {
      building[key] = null;
    }
    for (const key in data) {
      building[key] = data[key];
    }
    await Promise.all([building.save(), building.restore()]);
  }

  return building;
};

//edit building
const editBuilding = async (data) => {
  const reference = "editBuilding";
  if (!data.buildingId) {
    throw new AppError(reference, "Building ID is required", "custom", 412);
  }
  const building = await Building.findOne({
    where: { id: data.buildingId, propertyId: data.propertyId },
  });

  if (!building) {
    throw new AppError(reference, "Building not found", "custom", 404);
  }

  if (
    data.buildingType &&
    !Object.values(BUILDING_TYPES).includes(data.buildingType)
  ) {
    throw new AppError(
      reference,
      `Building type can only be ${Object.values(BUILDING_TYPES).join(", ")}`,
      "custom",
      412
    );
  }

  if (data.location) {
    if (!Array.isArray(data.location) || data.location.length !== 2) {
      throw new AppError(
        reference,
        "Please enter valid location",
        "custom",
        412
      );
    }
    data.location = {
      type: "Point",
      coordinates: data.location,
    };
  }

  if (
    data.name_en &&
    (await getBuilding({
      name_en: data.name_en,
      propertyId: data.propertyId,
      id: { [Op.ne]: building.id },
    }))
  ) {
    throw AppError(
      reference,
      "Building already exists with mentioned name",
      "custom",
      412
    );
  }

  if (
    data.governmentPropertyId &&
    (await getBuilding({
      governmentPropertyId: data.governmentPropertyId,
      propertyId: data.propertyId,
      id: { [Op.ne]: building.id },
    }))
  ) {
    throw AppError(
      reference,
      "Building already exists with mentioned ID",
      "custom",
      412
    );
  }

  if (data.localityId && !(await getLocality({ id: data.localityId }))) {
    throw new AppError(reference, "Locality not found", "custom", 404);
  }

  data.contactName &&
    (building.primaryContact = {
      ...building.primaryContact,
      name: data.contactName,
    });
  data.contactEmail &&
    (building.primaryContact = {
      ...building.primaryContact,
      email: data.contactEmail,
    });
  data.contactCountryCode &&
    (building.primaryContact = {
      ...building.primaryContact,
      countryCode: data.contactCountryCode,
    });
  data.contactMobileNumber &&
    (building.primaryContact = {
      ...building.primaryContact,
      mobileNumber: data.contactMobileNumber,
    });

  delete data.buildingId;
  delete data.propertyId;

  for (let key in data) {
    building[key] = data[key];
  }
  await building.save();
  return building;
};

//get buildings - to be viewed by admin
const getBuildingsWithCityAndLocality = async (
  params,
  language = LANGUAGES.EN,
  { offset, limit }
) => {
  if (params.search) {
    params[Op.or] = [
      { [`name_${language}`]: { [Op.iLike]: `%${params.search}%` } },
      { [`address_${language}`]: { [Op.iLike]: `%${params.search}%` } },
      { [`description_${language}`]: { [Op.iLike]: `%${params.search}%` } },
      { buildingType: { [Op.iLike]: `%${params.search}%` } },
      { governmentPropertyId: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  const buildings = await Building.findAndCountAll({
    where: params,
    include: {
      model: Locality,
      as: "locality",
      include: {
        model: City,
        as: "city",
      },
    },
    offset,
    limit,
    order: [[`updatedAt`, "DESC"]],
  });
  return buildings;
};

const getBuildingForAdmin = async (params) => {
  const building = await getBuildingWithCityAndLocality(params);
  if (!building) {
    throw new AppError(
      "getBuildingForAdmin",
      "Building not found",
      "custom",
      404
    );
  }
  return building;
};

async function getAllBuildings(params, language = LANGUAGES.EN) {
  enableSearch(params, "name", language);
  return await Building.findAndCountAll({
    where: params,
    order: [["name_en", "ASC"]],
    attributes: ["id", "name_en", "name_ar"],
  });
}

async function deleteBuilding(params) {
  const reference = "deleteBuilding";
  const building = await Building.findOne({
    where: params,
    attributes: {
      include: [
        [
          db.sequelize.cast(db.sequelize.literal(`COUNT(flats.id)`), "INTEGER"),
          "flatsCount",
        ],
      ],
    },
    group: "Building.id",
    include: {
      model: Flat,
      as: "flats",
      required: false,
      attributes: [],
    },
  });
  if (!building) {
    throw new AppError(reference, "Building not found", "custom", 404);
  }

  if (building.get("flatsCount")) {
    throw new AppError(
      reference,
      "Flat(s) exists in the building",
      "custom",
      412
    );
  }
  await building.destroy();

  return null;
}

async function getBuildingsListing(
  params,
  language = LANGUAGES.EN,
  { offset, limit }
) {
  const query = `
  select b.id, b.name_en, b.name_ar, b."buildingType",
  l.id as "locality.id", l.name_en as "locality.name_en", l.name_ar as "locality.name_ar",
  c.id as "city.id", c.name_en as "city.name_en", c.name_ar as "city.name_ar",
  case when fco."flatsCount" is null then 0 else fco."flatsCount" end as "totalFlats", 
  case when vf."flatsCount" is null then 0 else vf."flatsCount" end as "totalVacantFlats",
  COUNT (*) OVER () as count
  from buildings b
  join localities l on (l.id = b."localityId" and l."deletedAt" is null)
  join cities c on (c.id = l."cityId" and c."deletedAt" is null)
  left join (
    select count(*) as "flatsCount", "buildingId" from flats where "deletedAt" is null group by "buildingId"
  ) fco on (fco."buildingId" = b.id)
  left join (
    select count(f.id) as "flatsCount", f."buildingId" from flats f
    left join (
      select distinct on(l."flatId") l.id, l."flatId", ls.status from leases l
      join lease_statuses ls on (ls."leaseId" = l.id AND ls."deletedAt" is null)
      where l."deletedAt" is null order by l."flatId", l."createdAt" desc , ls."createdAt" desc
    ) l on (l."flatId" = f.id)
    where f."deletedAt" is null and (l.id is null or l.status in (:inActiveStatuses))
    group by f."buildingId"
  ) vf on (vf."buildingId" = b.id)
  where b."propertyId" = :propertyId    ${
    params.buildingType
      ? `and  b."buildingType" = '${params.buildingType}'`
      : ""
  } and b."deletedAt" is null
  ${params.buildingId ? `and b.id = '${params.buildingId}'` : ""}
  ${params.localityId ? `and l.id = '${params.localityId}'` : ""}
  ${params.cityId ? `and c.id = '${params.cityId}'` : ""}
  ${params.country ? `and c."country_en" = '${params.country}'` : ""}
  ${
    params.search
      ? `and (
    b.name_${language} ilike '%${params.search}%' OR
    b."buildingType" ilike '%${params.search}%' OR
    l.name_${language} ilike '%${params.search}%' OR
    c.name_${language} ilike '%${params.search}%'
  )`
      : ""
  }
  order by b."createdAt" desc
  limit :limit offset :offset`;
  const buildings = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      inActiveStatuses: new Array(
        LEASE_STATUSES.CANCELLED,
        LEASE_STATUSES.EXPIRED,
        LEASE_STATUSES.TERMINATED
      ),
      limit,
      offset,
    },
  });
  const count = buildings[0]?.count ? parseInt(buildings[0].count) : 0;
  buildings.map((building) => delete building.count);

  return {
    count,
    rows: buildings,
  };
}

module.exports = {
  addBuilding,
  editBuilding,
  getBuildingsWithCityAndLocality,
  getBuildingForAdmin,
  getAllBuildings,
  deleteBuilding,
  getBuildingsListing,
};
