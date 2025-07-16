const Inventory = require("../models/Inventory");
const { AppError } = require("../../utils/errorHandler");
const Building = require("../../building-service/models/Building");
const {
  getBuildings,
  getBuildingCount,
} = require("../../building-service/controllers/building");
const InventoryBuilding = require("../models/InventoryBuilding");
const { Op } = require("sequelize");
const db = require("../../database");

const getInventory = async (params) => {
  return await Inventory.findOne({ where: params });
};

const addInventory = async (data) => {
  const reference = "addInventory";

  if (
    await getInventory({
      name_en: data.name_en,
    })
  ) {
    throw new AppError(
      reference,
      "Inventory with same name already exists",
      "custom",
      412
    );
  }

  data.availableQuantity = data.totalQuantity;

  if (!("isForAllBuildings" in data) && !data.isForAllBuildings) {
    const buildingsCount = await getBuildingCount({
      id: {
        [Op.in]: data.buildings,
      },
    });
    if (buildingsCount.totalBuildings != data.buildings.length) {
      throw new AppError(
        reference,
        "Some of the selected building(s) is restricted",
        "custom",
        412
      );
    }
  }

  const inventory = await Inventory.create(data);
  const inventoryBuildings = [];
  if (data.isForAllBuildings) {
    (await getBuildings({ propertyId: data.propertyId })).forEach(
      (building) => {
        inventoryBuildings.push({
          inventoryId: inventory.id,
          buildingId: building.id,
        });
      }
    );
  } else {
    data.buildings.forEach((buildingId) => {
      inventoryBuildings.push({
        inventoryId: inventory.id,
        buildingId,
      });
    });
  }
  await InventoryBuilding.bulkCreate(inventoryBuildings);
  return inventory;
};

const updateInventory = async (data) => {
  const reference = "updateInventory";
  if (!data.id) {
    throw new AppError(reference, "Inventory ID is required", "custom", 412);
  }

  if (data.buildings && !Array.isArray(data.buildings)) {
    throw new AppError(
      reference,
      "Enter buildings in valid format",
      "custom",
      412
    );
  }

  const findInventory = await Inventory.findOne({
    where: { id: data.id },
  });

  if (!findInventory) {
    throw new AppError(reference, "Inventory not found", "custom", 404);
  }

  const inventoryId = data.id;
  const quantity = data.quantity;
  delete data.id, data.quantity;
  for (const key in data) {
    findInventory[key] = data[key];
  }
  findInventory.totalQuantity += quantity;
  findInventory.availableQuantity += quantity;
  if ("isForAllBuildings" in data || data.isForAllBuildings) {
    const allInventoryBuildings = await InventoryBuilding.findAll({
      where: { inventoryId: inventoryId },
      paranoid: false,
    });
    const inventoryBuildingsToRestore = await InventoryBuilding.findAll({
      where: { inventoryId: inventoryId, deletedAt: { [Op.ne]: null } },
      paranoid: false,
    });
    const buildingsToAdd = (
      await getBuildings({
        propertyId: data.propertyId,
        id: {
          [Op.notIn]: allInventoryBuildings.map((inventoryBuilding) => {
            return inventoryBuilding.buildingId;
          }),
        },
      })
    ).map((building) => {
      return {
        buildingId: building.id,
        inventoryId,
      };
    });
    await Promise.all([
      InventoryBuilding.bulkCreate(buildingsToAdd),
      InventoryBuilding.update(
        {
          deletedAt: null,
        },
        {
          where: {
            id: {
              [Op.in]: inventoryBuildingsToRestore.map((inventoryBuilding) => {
                return inventoryBuilding.id;
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
    const inventories = [];
    await Promise.all(
      data.buildings.map(async (buildingId) => {
        const [inventoryBuilding, created] =
          await InventoryBuilding.findOrCreate({
            where: {
              inventoryId,
              buildingId,
            },
            paranoid: false,
          });
        if (!created && inventoryBuilding.deletedAt) {
          await inventoryBuilding.restore();
        }
        inventories.push(inventoryBuilding.buildingId);
      })
    );
    await InventoryBuilding.destroy({
      where: {
        inventoryId,
        buildingId: {
          [Op.notIn]: inventories,
        },
      },
    });
  }
  await findInventory.save();
  return findInventory;
};

const getInventoryByBuildingId = async (
  { buildingId, search, status, inventoryType },
  { offset, limit }
) => {
  let params = {};

  if (search) {
    params = {
      [Op.or]: [
        { name_en: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
        { unit: { [Op.iLike]: `%${search}%` } },
      ],
    };
  }

  if (status) {
    params.status = status;
  }

  if (inventoryType) {
    params.inventoryType = inventoryType;
  }

  const findInventory = await Inventory.findAndCountAll({
    where: {
      [Op.and]: [
        {
          "$inventoryBuildings.buildingId$": buildingId,
        },
        params,
      ],
    },
    distinct: true,
    order: [["updatedAt", "DESC"]],
    attributes: {
      include: ["updatedAt"],
    },
    include: [
      {
        model: InventoryBuilding,
        as: "inventoryBuildings",
        required: true,
        attributes: ["buildingId"],
        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: ["name_en", "id", "name_ar"],
        },
      },
    ],
    offset,
    limit,
    subQuery: false,
  });
  return findInventory;
};

const getInventoryByPropertyId = async (
  { propertyId, search, status, inventoryType },
  { offset, limit }
) => {
  let params = {};

  if (search) {
    params = {
      [Op.or]: [
        { name_en: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
        { unit: { [Op.iLike]: `%${search}%` } },
      ],
    };
  }
  if (status) {
    params.status = status;
  }

  if (inventoryType) {
    params.inventoryType = inventoryType;
  }

  const findInventory = await Inventory.findAndCountAll({
    where: params,
    distinct: true,
    order: [["updatedAt", "DESC"]],
    attributes: {
      include: ["updatedAt"],
    },
    include: [
      {
        model: InventoryBuilding,
        as: "inventoryBuildings",
        attributes: ["id", "buildingId"],
        include: {
          model: Building,
          as: "building",
          where: { propertyId },
          attributes: ["name_en", "id", "name_ar"],
        },
      },
    ],
    offset,
    limit,
  });
  return findInventory;
};

const deleteInventory = async (params) => {
  const reference = "deleteInventory";
  const inventory = await Inventory.findOne({
    where: params,
  });
  if (!inventory) {
    throw new AppError(reference, "Inventory not found", "custom", 404);
  }
  await inventory.destroy();
  return null;
};

const getInventoryWithBuilding = async (params) => {
  const findInventory = await Inventory.findOne({
    where: params,
    include: {
      model: InventoryBuilding,
      as: "inventoryBuildings",
      required: true,
      attributes: ["buildingId"],
      include: {
        model: Building,
        as: "building",
        required: true,
        attributes: ["name_en", "id", "name_ar"],
      },
    },
  });
  return findInventory;
};

const getInventoryDropdown = async ({ propertyId, buildingId }) => {
  let params = {};
  if (buildingId) {
    params["$inventoryBuildings.buildingId$"] = buildingId;
  }
  const findInventory = await Inventory.findAll({
    where: params,
    distinct: true,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: InventoryBuilding,
        as: "inventoryBuildings",
        attributes: [],
        include: {
          model: Building,
          as: "building",
          where: { propertyId },
          attributes: [],
        },
      },
    ],
  });
  return findInventory;
};

module.exports = {
  addInventory,
  updateInventory,
  getInventoryByBuildingId,
  getInventoryByPropertyId,
  deleteInventory,
  getInventory,
  getInventoryWithBuilding,
  getInventoryDropdown,
};
