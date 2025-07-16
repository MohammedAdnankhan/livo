const { Op } = require("sequelize");
const Building = require("../../building-service/models/Building");
const { LANGUAGES } = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const HelplineBuilding = require("../models/HelplineBuilding");
const HelplineNumber = require("../models/HelplineNumber");
const {
  getBuildings,
  getBuildingCount,
} = require("../../building-service/controllers/building");

const getHelplines = async (flatId, language) => {
  const query = `
  select hn.id, hn.name_${language} as name, hn."countryCode", hn."contactNumber", hn.image,
  case when hn."countryCode" is null or hn."countryCode" = '' then true else false end as "isTollFree"
  from helpline_numbers hn
  join helpline_buildings hb on (hb."helplineId" = hn.id and hb."deletedAt" is null)
  join flats f on (f."buildingId" = hb."buildingId" and f."deletedAt" is null and f.id = :flatId)
  where hn."deletedAt" is null order by hn."createdAt" asc`;

  return await db.sequelize.query(query, {
    replacements: { flatId },
    type: db.Sequelize.QueryTypes.SELECT,
  });
};

const addHelpline = async (data) => {
  const reference = "addHelpline";
  if (!data.name_en || !data.contactNumber) {
    throw new AppError(reference, "Required fields are empty", "custom", 412);
  }

  if (!data.buildings && !("isForAllBuildings" in data)) {
    throw new AppError(reference, "Building(s) is/are required", "custom", 412);
  }

  if ("isForAllBuildings" in data && !data.isForAllBuildings) {
    if (!Array.isArray(data.buildings) || !data.buildings?.length) {
      throw new AppError(
        reference,
        "Select at least one building",
        "custom",
        412
      );
    }
  }

  //validate if helpline already exists
  if (await getHelpline({ name_en: data.name_en })) {
    throw new AppError(
      reference,
      "Helpline name already exists",
      "custom",
      412
    );
  }
  let helpline = null;

  try {
    helpline = await HelplineNumber.create(data);
  } catch (error) {
    helpline = await HelplineNumber.findOne({
      where: {
        name_en: data.name_en,
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });
    if (!helpline) {
      throw error;
    }
    for (const key in helpline.get({ plain: true })) {
      helpline[key] = null;
    }
    for (const key in data) {
      helpline[key] = data[key];
    }
    await Promise.all([helpline.save(), helpline.restore()]);
  }

  if (helpline) {
    const helplineBuildings = [];
    if (data.isForAllBuildings) {
      (await getBuildings({ propertyId: data.propertyId })).map((building) => {
        helplineBuildings.push({
          helplineId: helpline.id,
          buildingId: building.id,
        });
      });
    } else {
      data.buildings.map((buildingId) => {
        helplineBuildings.push({
          helplineId: helpline.id,
          buildingId,
        });
      });
    }
    await HelplineBuilding.bulkCreate(helplineBuildings);
  }
  return null;
};

const updateHelplineNumber = async (data = {}) => {
  const reference = "updateHelplineNumber";
  if (!data.id) {
    throw new AppError(reference, "Helpline ID is required", "custom", 412);
  }

  if (data.buildings && !Array.isArray(data.buildings)) {
    throw new AppError(
      "updateNotice",
      "Enter buildings in valid format",
      "custom",
      412
    );
  }

  const findHelpline = await HelplineNumber.findOne({
    where: { id: data.id },
  });

  if (!findHelpline) {
    throw new AppError(reference, "Helpline number not found", "custom", 404);
  }

  const helplineId = data.id;
  delete data.id;

  for (const key in data) {
    findHelpline[key] = data[key];
  }

  if ("isForAllBuildings" in data && data.isForAllBuildings) {
    const existingHelplineBuildings = await HelplineBuilding.findAll({
      where: {
        helplineId,
      },
      paranoid: false,
    });

    const helplineBuildingsToRestore = await HelplineBuilding.findAll({
      where: {
        helplineId,
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });

    const buildingsToAdd = (
      await getBuildings({
        propertyId: data.propertyId,
        id: {
          [Op.notIn]: existingHelplineBuildings.map((helplineBuilding) => {
            return helplineBuilding.buildingId;
          }),
        },
      })
    ).map((building) => {
      return {
        buildingId: building.id,
        helplineId,
      };
    });

    await Promise.all([
      HelplineBuilding.bulkCreate(buildingsToAdd),
      HelplineBuilding.update(
        {
          deletedAt: null,
        },
        {
          where: {
            id: {
              [Op.in]: helplineBuildingsToRestore.map((helplineBuilding) => {
                return helplineBuilding.id;
              }),
            },
          },
          paranoid: false,
        }
      ),
    ]);
  }

  if (
    (!("isForAllBuildings" in data) || !data.isForAllBuildings) &&
    data.buildings
  ) {
    const helplinesToKeep = [];
    await Promise.all(
      data.buildings.map(async (buildingId) => {
        const [helplineBuilding, created] = await HelplineBuilding.findOrCreate(
          {
            where: {
              helplineId,
              buildingId,
            },
            paranoid: false,
          }
        );
        if (!created && helplineBuilding.deletedAt) {
          await helplineBuilding.restore();
        }
        helplinesToKeep.push(helplineBuilding.buildingId);
      })
    );
    await HelplineBuilding.destroy({
      where: {
        helplineId,
        buildingId: {
          [Op.notIn]: helplinesToKeep,
        },
      },
    });
  }

  await findHelpline.save();
  return null;
};

const getHelpline = async (params) => {
  return await HelplineNumber.findOne({ where: params });
};

const getHelplineWithBuilding = async (params) => {
  const reference = "getHelplineWithBuilding";
  const [helpline, { totalBuildings }] = await Promise.all([
    HelplineNumber.findOne({
      where: { id: params.id },
      attributes: {
        include: [
          [
            db.sequelize.literal(`
          case when "HelplineNumber"."countryCode" is null or "HelplineNumber"."countryCode" in ('', ' ') then true else false end`),
            "isTollFree",
          ],
        ],
      },
      include: [
        {
          model: HelplineBuilding,
          as: "helplineBuildings",
          attributes: ["id", "buildingId"],
          include: [
            {
              model: Building,
              as: "building",
              required: true,
              attributes: ["id", "name_en", "name_ar"],
            },
          ],
        },
      ],
    }),
    getBuildingCount({ propertyId: params.propertyId }),
  ]);

  if (!helpline) {
    throw new AppError(reference, "Helpline number not found", "custom", 404);
  }

  return {
    ...JSON.parse(JSON.stringify(helpline)),
    isForAllBuildings:
      +totalBuildings == helpline.helplineBuildings.length ? true : false,
  };
};

async function getHelplinesFromProperty(
  params,
  { limit, offset },
  language = LANGUAGES.EN
) {
  const reference = "getHelplinesFromProperty";
  const buildingParams = { propertyId: params.propertyId };
  delete params.propertyId;
  if (params.search) {
    params[Op.or] = [
      { [`name_${language}`]: { [Op.iLike]: `%${params.search}%` } },
      { countryCode: { [Op.iLike]: `%${params.search}%` } },
      { contactNumber: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  const helplines = await HelplineNumber.findAll({
    distinct: true,
    where: params,
    attributes: {
      include: [
        [
          db.sequelize.literal(`
          case
            when "HelplineNumber"."countryCode" is null or "HelplineNumber"."countryCode" in ('', ' ') then true else false end`),
          "isTollFree",
        ],
        [db.sequelize.literal(`COUNT (*) OVER ()`), "count"],
        "createdAt",
      ],
    },
    order: [["createdAt", "DESC"]],
    offset,
    limit,
    include: [
      {
        model: HelplineBuilding,
        as: "helplineBuildings",
        attributes: ["id", "buildingId"],
        include: [
          {
            model: Building,
            as: "building",
            where: buildingParams,
            attributes: ["id", "name_en", "name_ar"],
          },
        ],
      },
    ],
  });

  const count = helplines[0]?.get("count");
  return {
    count: count ? +count : 0,
    rows: helplines,
  };
}

async function getHelplinesFromBuilding(
  params,
  { limit, offset },
  language = LANGUAGES.EN
) {
  const reference = "getHelplinesFromBuilding",
    buildingParams = { buildingId: params.buildingId };
  delete params.buildingId;
  if (params.search) {
    params[Op.or] = [
      { [`name_${language}`]: { [Op.iLike]: `%${params.search}%` } },
      { countryCode: { [Op.iLike]: `%${params.search}%` } },
      { contactNumber: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  const helplines = await HelplineNumber.findAndCountAll({
    distinct: true,
    where: params,
    order: [["createdAt", "DESC"]],
    attributes: {
      include: [
        [
          db.sequelize.literal(`
          case
            when "HelplineNumber"."countryCode" is null or "HelplineNumber"."countryCode" in ('', ' ') then true else false end`),
          "isTollFree",
        ],
        "createdAt",
      ],
    },
    offset,
    limit,
    include: [
      {
        model: HelplineBuilding,
        as: "helplineBuildings",
        attributes: ["id", "buildingId"],
        where: buildingParams,
        include: [
          {
            model: Building,
            as: "building",
            attributes: ["id", "name_en", "name_ar"],
          },
        ],
      },
    ],
  });
  return helplines;
}

async function createHelplines(data) {
  const reference = "createHelplines",
    helplineData = [];
  if (!data.name_en || !data.name_ar || !data.contactNumber) {
    throw new AppError(reference, "Requried fields are empty", "custom", 412);
  }

  //validate if mentioned helpline already exists in any of the selected building
  await Promise.all(
    data.buildings.map(async (buildingId) => {
      const helpline = await getHelplineWithBuilding({
        name_en: data.name_en,
        buildingId,
      });
      if (helpline) {
        throw new AppError(
          reference,
          `Contact already exists in ` + helpline.building?.name_en,
          "custom",
          412
        );
      }
      const helplineObj = {
        name_en: data.name_en,
        name_ar: data.name_ar,
        countryCode: data.countryCode ? data.countryCode : null,
        contactNumber: data.contactNumber,
        image: data.image,
        buildingId,
      };
      helplineData.push(helplineObj);
    })
  );
  await HelplineNumber.bulkCreate(helplineData);
  return "Helpline numbers created successfully";
}

async function deleteHelpline(params) {
  const reference = "deleteHelpline";
  const helpline = await HelplineNumber.findOne({
    where: params,
  });
  if (!helpline) {
    throw new AppError(reference, "Helpline number not found", "custom", 404);
  }
  await helpline.destroy();
  return null;
}

module.exports = {
  getHelplines,
  addHelpline,
  updateHelplineNumber,
  getHelpline,
  getHelplinesFromProperty,
  getHelplinesFromBuilding,
  getHelplineWithBuilding,
  createHelplines,
  deleteHelpline,
};
