const Asset = require("../models/Asset");
const { AppError } = require("../../utils/errorHandler");
const { Op } = require("sequelize");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const Administrator = require("../../admin-service/models/Admin");
const { isValidUUID } = require("../../utils/utility");
const db = require("../../database");
const { ASSET_CONDITIONS } = require("../../config/constants");
const { getFlat } = require("../../flat-service/controllers/flat");
const { getBuilding } = require("../../building-service/controllers/building");

//create asset
async function createAsset(data) {
  const reference = "createAsset";
  if (!data.name || !data.category || !data.condition) {
    throw new AppError(reference, "Required fields are empty", "custom", 412);
  }
  if (!data.flatId && (!data.buildingId || !data.floor || !data.location)) {
    throw new AppError(
      reference,
      "Asset has to be assigned to either flat or building",
      "custom",
      412
    );
  }

  if (data.flatId && isValidUUID(data.flatId)) {
    if (!(await getFlat({ id: data.flatId }))) {
      throw new AppError(reference, "Flat not found", "custom", 404);
    }
    delete data.buildingId;
    delete data.floor;
    delete data.location;
  } else if (data.buildingId && isValidUUID(data.buildingId)) {
    if (!(await getBuilding({ id: data.buildingId }))) {
      throw new AppError(reference, "Building not found", "custom", 404);
    }
    delete data.flatId;
  } else {
    throw new AppError(
      reference,
      "Enter building or flat in valid format",
      "custom",
      412
    );
  }

  if (
    data.condition &&
    !Object.values(ASSET_CONDITIONS).includes(data.condition)
  ) {
    throw new AppError(
      reference,
      `Condition can only be ${Object.values(ASSET_CONDITIONS).join(", ")}`,
      "custom",
      412
    );
  }

  if (data.documents && !Array.isArray(data.documents)) {
    throw new AppError(
      reference,
      "Enter documents in valid format",
      "custom",
      412
    );
  }
  if (data.tags && !Array.isArray(data.tags)) {
    throw new AppError(reference, "Enter tags in valid format", "custom", 412);
  }
  await Asset.create(data);
  return "Asset created successfully";
}

//get assets
async function getAssetsOfBuilding(params, { offset, limit }) {
  params[Op.and] = [
    {
      [Op.or]: [
        { "$flat.id$": { [Op.ne]: null } },
        { "$building.id$": { [Op.ne]: null } },
      ],
    },
  ];
  if (params.search) {
    params[Op.and].push({
      [Op.or]: [
        db.sequelize.where(
          db.sequelize.cast(db.sequelize.col("Asset.id"), "varchar"),
          {
            [Op.iLike]: `%${params.search}%`,
          }
        ),
        { name: { [Op.iLike]: `%${params.search}%` } },
        { category: { [Op.iLike]: `%${params.search}%` } },
        { condition: { [Op.iLike]: `%${params.search}%` } },
        { floor: { [Op.iLike]: `%${params.search}%` } },
        { location: { [Op.iLike]: `%${params.search}%` } },
        { description: { [Op.iLike]: `%${params.search}%` } },
        { brand: { [Op.iLike]: `%${params.search}%` } },
        { model: { [Op.iLike]: `%${params.search}%` } },
        { "$building.name_en$": { [Op.iLike]: `%${params.search}%` } },
        { "$flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
        { "$flat->building.name_en$": { [Op.iLike]: `%${params.search}%` } },
      ],
    });
  }
  const buildingId = params.buildingId;
  delete params.search;
  delete params.buildingId;
  return await Asset.findAndCountAll({
    where: params,
    order: [["createdAt", "ASC"]],
    offset,
    limit,
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `CASE WHEN "Asset"."flatId" IS NULL THEN false ELSE true END`
          ),
          "isForFlat",
        ],
      ],
    },
    include: [
      {
        model: Flat,
        as: "flat",
        required: false,
        where: { buildingId },
        attributes: ["id", "name_en", "name_ar", "buildingId"],
        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: ["id", "name_en", "name_ar"],
        },
      },
      {
        model: Building,
        as: "building",
        required: false,
        attributes: ["id", "name_en", "name_ar"],
        where: {
          id: buildingId,
        },
      },
      {
        model: Administrator,
        as: "admin",
        required: false,
        attributes: ["id", "name"],
      },
    ],
  });
}

async function getAssetsOfProperty(params, { offset, limit }) {
  params[Op.and] = [
    {
      [Op.or]: [
        { "$flat.id$": { [Op.ne]: null } },
        { "$building.id$": { [Op.ne]: null } },
      ],
    },
  ];
  if (params.search) {
    params[Op.and].push({
      [Op.or]: [
        db.sequelize.where(
          db.sequelize.cast(db.sequelize.col("Asset.id"), "varchar"),
          {
            [Op.iLike]: `%${params.search}%`,
          }
        ),
        { name: { [Op.iLike]: `%${params.search}%` } },
        { category: { [Op.iLike]: `%${params.search}%` } },
        { condition: { [Op.iLike]: `%${params.search}%` } },
        { floor: { [Op.iLike]: `%${params.search}%` } },
        { location: { [Op.iLike]: `%${params.search}%` } },
        { description: { [Op.iLike]: `%${params.search}%` } },
        { brand: { [Op.iLike]: `%${params.search}%` } },
        { model: { [Op.iLike]: `%${params.search}%` } },
        { "$building.name_en$": { [Op.iLike]: `%${params.search}%` } },
        { "$flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
        { "$flat->building.name_en$": { [Op.iLike]: `%${params.search}%` } },
      ],
    });
  }
  const propertyId = params.propertyId;
  delete params.search;
  delete params.propertyId;
  return await Asset.findAndCountAll({
    where: params,
    order: [["createdAt", "ASC"]],
    offset,
    limit,
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `CASE WHEN "Asset"."flatId" IS NULL THEN false ELSE true END`
          ),
          "isForFlat",
        ],
      ],
    },
    include: [
      {
        model: Flat,
        as: "flat",
        required: false,
        attributes: ["id", "name_en", "name_ar", "buildingId"],
        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: ["id", "name_en", "name_ar"],
          where: {
            propertyId,
          },
        },
      },
      {
        model: Building,
        as: "building",
        required: false,
        attributes: ["id", "name_en", "name_ar"],
        where: {
          propertyId,
        },
      },
      {
        model: Administrator,
        as: "admin",
        required: false,
        attributes: ["id", "name"],
      },
    ],
  });
}

async function getAsset(params) {
  return await Asset.findOne({ where: params });
}

async function getAssetDetails(
  { id, propertyId },
  reference = "getAssetDetails"
) {
  const asset = await Asset.findOne({
    where: {
      [Op.and]: [
        { id },
        {
          [Op.or]: [
            { "$flat.id$": { [Op.ne]: null } },
            { "$building.id$": { [Op.ne]: null } },
          ],
        },
      ],
    },
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `CASE WHEN "Asset"."flatId" IS NULL THEN false ELSE true END`
          ),
          "isForFlat",
        ],
      ],
      exclude: ["tags"],
    },
    include: [
      {
        model: Flat,
        as: "flat",
        required: false,
        attributes: ["id", "name_en", "name_ar", "buildingId"],
        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: ["id", "name_en", "name_ar"],
          where: {
            propertyId,
          },
        },
      },
      {
        model: Building,
        as: "building",
        required: false,
        attributes: ["id", "name_en", "name_ar"],
        where: {
          propertyId,
        },
      },
      {
        model: Administrator,
        as: "admin",
        required: false,
        attributes: ["id", "name"],
      },
    ],
  });
  if (!asset) {
    throw new AppError(reference, "Asset not found", "custom", 404);
  }
  return asset;
}

async function deleteAsset(params) {
  const reference = "deleteAsset";
  const asset = await getAssetDetails(params, reference);
  await asset.destroy();
  return "Asset removed successfully";
}

async function updateAsset(data) {
  const reference = "updateAsset";
  const asset = await getAssetDetails(
    { id: data.id, propertyId: data.propertyId },
    reference
  );
  if (data.buildingId && (!data.floor || !data.location)) {
    throw new AppError(
      reference,
      "Required fields are empty to assign to a building",
      "custom",
      412
    );
  }
  if (
    data.condition &&
    !Object.values(ASSET_CONDITIONS).includes(data.condition)
  ) {
    throw new AppError(
      reference,
      `Condition can only be ${Object.values(ASSET_CONDITIONS).join(", ")}`,
      "custom",
      412
    );
  }
  if (data.buildingId) {
    if (!(await getBuilding({ id: data.buildingId }))) {
      throw new AppError(reference, "Building not found", "custom", 404);
    }
    data.flatId = null;
  } else if (data.flatId) {
    if (!(await getFlat({ id: data.flatId }))) {
      throw new AppError(reference, "Flat not found", "custom", 404);
    }
    data.buildingId = null;
    data.floor = null;
    data.location = null;
  }
  delete data.id;
  for (const key in data) {
    asset[key] = data[key];
  }
  await asset.save();
  return "Asset updated successfully";
}

async function getAssetListOfProperty(params) {
  params[Op.and] = [
    {
      [Op.or]: [
        { "$flat.id$": { [Op.ne]: null } },
        { "$building.id$": { [Op.ne]: null } },
      ],
    },
  ];
  if (params.search) {
    params[Op.and].push({
      [Op.or]: [
        db.sequelize.where(
          db.sequelize.cast(db.sequelize.col("Asset.id"), "varchar"),
          {
            [Op.iLike]: `%${params.search}%`,
          }
        ),
        { name: { [Op.iLike]: `%${params.search}%` } },
        // { category: { [Op.iLike]: `%${params.search}%` } },
        // { condition: { [Op.iLike]: `%${params.search}%` } },
        // { floor: { [Op.iLike]: `%${params.search}%` } },
        // { brand: { [Op.iLike]: `%${params.search}%` } },
        // { location: { [Op.iLike]: `%${params.search}%` } },
        // { description: { [Op.iLike]: `%${params.search}%` } },
        // { model: { [Op.iLike]: `%${params.search}%` } },
        // { "$building.name_en$": { [Op.iLike]: `%${params.search}%` } },
        // { "$flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
        // { "$flat->building.name_en$": { [Op.iLike]: `%${params.search}%` } },
      ],
    });
  }
  const propertyId = params.propertyId;
  if (params.buildingId) {
    params[Op.and].push({
      [Op.or]: [
        { "$flat->building.id$": params.buildingId },
        { buildingId: params.buildingId },
      ],
    });
  }
  if (params.flatId) {
    params[Op.and].push({
      "$flat.id$": params.flatId,
    });
  }
  delete params.search;
  delete params.propertyId;
  delete params.buildingId;
  delete params.flatId;

  return await Asset.findAndCountAll({
    where: params,
    order: [["name", "ASC"]],
    attributes: [
      "id",
      "name",
      "assetId",
      [
        db.sequelize.literal(
          `CASE WHEN "Asset"."flatId" IS NULL THEN false ELSE true END`
        ),
        "isForFlat",
      ],
    ],
    include: [
      {
        model: Flat,
        as: "flat",
        required: false,
        attributes: [],
        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: [],
          where: {
            propertyId,
          },
        },
      },
      {
        model: Building,
        as: "building",
        required: false,
        attributes: [],
        where: {
          propertyId,
        },
      },
    ],
  });
}

module.exports = {
  getAssetsOfBuilding,
  getAssetsOfProperty,
  createAsset,
  getAsset,
  getAssetDetails,
  deleteAsset,
  updateAsset,
  getAssetListOfProperty,
};
