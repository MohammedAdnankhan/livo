const { DataTypes } = require("sequelize");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");
const { BILLED_FOR } = require("../../config/constants");
const Inventory = require("../../inventory-service/models/Inventory");

const MaintenanceProduct = db.sequelize.define(
  "MaintenanceProduct",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    inventoryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    maintenanceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    billedFor: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(BILLED_FOR),
          "Invalid value for field Billed at"
        ),
      },
    },
    quantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "maintenance_products",
    paranoid: true,
    indexes: [
      {
        fields: ["inventoryId", "maintenanceId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);
// MaintenanceProduct.sync({ alter: true });

MaintenanceProduct.belongsTo(Inventory, {
  as: "inventory",
  foreignKey: "inventoryId",
});

module.exports = MaintenanceProduct;
