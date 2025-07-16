const { DataTypes } = require("sequelize");
const db = require("../../database");
const Inventory = require("./Inventory");
const Building = require("../../building-service/models/Building");

const InventoryBuilding = db.sequelize.define(
  "InventoryBuilding",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    inventoryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "inventory_buildings",
    paranoid: true,
    indexes: [
      {
        fields: ["inventoryId", "buildingId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

InventoryBuilding.belongsTo(Building, {
  as: "building",
  foreignKey: "buildingId",
});

module.exports = InventoryBuilding;
