const { DataTypes } = require("sequelize");
const { CHARGE_CATEGORIES, CURRENCY } = require("../../config/constants");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");

const MaintenanceChargeCatalogue = db.sequelize.define(
  "MaintenanceChargeCatalogue",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    chargeName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.values(CURRENCY), "Invalid Currency"),
      },
      defaultValue: CURRENCY.AED,
    },
    serviceCost: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.keys(CHARGE_CATEGORIES), "Invalid category"),
      },
    },
  },
  {
    tableName: "maintenance_charge_catalogues",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

// MaintenanceChargeCatalogue.sync({ force: true });
// MaintenanceChargeCatalogue.sync({ alter: true });

module.exports = MaintenanceChargeCatalogue;
