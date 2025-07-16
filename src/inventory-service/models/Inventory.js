const { DataTypes } = require("sequelize");
const db = require("../../database");
const Property = require("../../property-service/models/Property");
const { acceptedValues } = require("../../utils/modelValidators");
const {
  INVENTORY_STATUSES,
  UNIT_TYPES,
  INVENTORY_TYPES,
} = require("../../config/constants");
const InventoryBuilding = require("./InventoryBuilding");

const Inventory = db.sequelize.define(
  "Inventory",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name_en: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name_ar: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    inventoryType: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(INVENTORY_TYPES),
          "Invalid Inventory Type"
        ),
      },
    },
    rate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(INVENTORY_STATUSES),
          "Invalid Inventory Status"
        ),
      },
      defaultValue: INVENTORY_STATUSES.ACTIVE,
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(Object.values(UNIT_TYPES), "Invalid Unit Type"),
      },
      defaultValue: UNIT_TYPES.UNIT,
    },
    totalQuantity: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    availableQuantity: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "inventories",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt", "propertyId"],
      },
    },
    indexes: [
      {
        fields: ["name_en", "propertyId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
    hooks: {
      beforeValidate: function (instance, options) {
        const { name_en, name_ar } = instance.dataValues;
        if (!name_ar) {
          instance.dataValues.name_ar = name_en + "_ar";
        }
        if (name_ar && name_ar.includes("_ar")) {
          const name = name_ar.split("_")[0];
          if (name !== name_en) {
            instance.dataValues.name_ar = name_en + "_ar";
          }
        }
      },
    },
  }
);

Inventory.hasMany(InventoryBuilding, {
  as: "inventoryBuildings",
  foreignKey: "inventoryId",
});

// Inventory.sync({ alter: true });

module.exports = Inventory;
