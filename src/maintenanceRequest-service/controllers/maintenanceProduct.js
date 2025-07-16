const MaintenanceProduct = require("../models/MaintenanceProduct");
const Flat = require("../../flat-service/models/Flat");
const { AppError } = require("../../utils/errorHandler");
const Inventory = require("../../inventory-service/models/Inventory");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const MaintenanceStatus = require("../models/MaintenanceStatus");
const { MAINTENANCE_STATUSES } = require("../../config/constants");
const { getMaintenanceRequest } = require("./maintenanceRequest");
const db = require("../../database");
const {
  getInventory,
} = require("../../inventory-service/controllers/inventory");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

const getMaintenanceProduct = async (params) => {
  return await MaintenanceProduct.findOne({ where: params });
};

const addMaintenanceProduct = async (data) => {
  const reference = "addMaintenanceProduct";
  const responseArr = [];
  if (!Array.isArray(data.inventories) || !data.inventories?.length) {
    throw new AppError(reference, "Add at least one product", "custom", 412);
  }
  const findRequest = await MaintenanceRequest.findOne({
    where: { id: data.maintenanceId },
    include: {
      model: MaintenanceStatus,
      as: "statusDetails",
      required: true,
      order: [["createdAt", "DESC"]],
      limit: 1,
    },
  });
  if (!findRequest) {
    throw new AppError(reference, "Request not found", "custom", 412);
  }
  if (
    findRequest.statusDetails[0].status !==
      MAINTENANCE_STATUSES.PROCESSING.key &&
    findRequest.statusDetails[0].status !== MAINTENANCE_STATUSES.ASSIGNED.key
  ) {
    throw new AppError(
      reference,
      "Request needs to be in process or assigned",
      "custom",
      425
    );
  }
  if (
    !data.inventories.every(
      (row) => row.quantity && row.inventoryId && row.billedFor
    )
  ) {
    throw new AppError(
      reference,
      "Some of the mandatory fields is invalid",
      "custom",
      412
    );
  }
  for (const inventory of data.inventories) {
    const t = await db.sequelize.transaction();
    try {
      const existingProductRequest = await getMaintenanceProduct({
        maintenanceId: data.maintenanceId,
        inventoryId: inventory.inventoryId,
      });
      const findInventory = await getInventory({
        id: inventory.inventoryId,
      });
      if (!findInventory) {
        throw new AppError(reference, "Inventory not found", "custom", 412);
      }
      if (findInventory.availableQuantity < inventory.quantity) {
        throw new AppError(
          reference,
          `Insufficient Quantity for ${findInventory.name_en}`,
          "custom",
          412
        );
      }
      if (existingProductRequest) {
        existingProductRequest.quantity += inventory.quantity;
        findInventory.availableQuantity -= inventory.quantity;
        await existingProductRequest.save({ transaction: t });
        await findInventory.save({ transaction: t });
        responseArr.push({
          success: true,
          data: {
            id: existingProductRequest.id,
            inventoryId: existingProductRequest.inventoryId,
            maintenanceId: existingProductRequest.maintenanceId,
            billedFor: existingProductRequest.billedFor,
            quantity: existingProductRequest.quantity,
            inventory: {
              name: findInventory.name_en,
              availableQuantity: findInventory.availableQuantity,
              rate: findInventory.rate,
              description: findInventory.description,
            },
          },
        });
      } else {
        const newProductRequest = await MaintenanceProduct.create(
          {
            inventoryId: inventory.inventoryId,
            maintenanceId: data.maintenanceId,
            billedFor: inventory.billedFor,
            quantity: inventory.quantity,
            adminId: data.adminId,
          },
          {
            transaction: t,
          }
        );
        findInventory.availableQuantity -= inventory.quantity;
        await findInventory.save({ transaction: t });
        responseArr.push({
          success: true,
          data: {
            id: newProductRequest.id,
            inventoryId: newProductRequest.inventoryId,
            maintenanceId: newProductRequest.maintenanceId,
            billedFor: newProductRequest.billedFor,
            quantity: newProductRequest.quantity,
            inventory: {
              name: findInventory.name_en,
              availableQuantity: findInventory.availableQuantity,
              rate: findInventory.rate,
              description: findInventory.description,
            },
          },
        });
      }
      await t.commit();
    } catch (error) {
      //logger.warn(error.message);
      await t.rollback();
      responseArr.push({
        success: false,
        message: error.message,
      });
    }
  }
  return responseArr;
};
const removeMaintenanceProduct = async ({ productId }) => {
  const reference = "removeMaintenanceProduct";
  const getProduct = await getMaintenanceProduct({
    id: productId,
  });
  if (!getProduct) {
    throw new AppError(reference, "Product not found", "custom", 404);
  }
  const findInventory = await getInventory({
    id: getProduct.inventoryId,
  });
  if (findInventory) {
    findInventory.availableQuantity += getProduct.quantity;
  }
  await getProduct.destroy();
  findInventory
    .save()
    .catch((error) =>
      logger.error(
        `error in saving inventory: ${JSON.stringify(error.message)}`
      )
    );
  return null;
};

const updateMaintenanceProduct = async (data) => {
  const reference = "updateMaintenanceProduct";
  const getProduct = await getMaintenanceProduct({
    id: data.productId,
  });
  if (!getProduct) {
    throw new AppError(reference, "Product not found", "custom", 404);
  }
  const findInventory = await getInventory({
    id: getProduct.inventoryId,
  });
  if (data.quantity) {
    if (findInventory.availableQuantity < data.quantity) {
      throw new AppError(
        reference,
        `Insufficient Quantity for ${findInventory.name_en}`,
        "custom",
        412
      );
    }
    if (findInventory)
      if (getProduct.quantity < data.quantity) {
        const difference = data.quantity - getProduct.quantity;
        getProduct.quantity = data.quantity;
        findInventory.availableQuantity -= difference;
      }
    if (getProduct.quantity > data.quantity) {
      const difference = getProduct.quantity - data.quantity;
      getProduct.quantity = data.quantity;
      findInventory.availableQuantity += difference;
    }
  }
  if (data.billedFor) {
    getProduct.billedFor = data.billedFor;
  }
  await Promise.all([getProduct.save(), findInventory.save()]);
  return null;
};

module.exports = {
  addMaintenanceProduct,
  removeMaintenanceProduct,
  updateMaintenanceProduct,
};
