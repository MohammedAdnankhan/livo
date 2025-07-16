const { DataTypes } = require("sequelize");
const { CHARGE_TYPES } = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const MaintenanceRequest = require("../../maintenanceRequest-service/models/MaintenanceRequest");
const { acceptedValues } = require("../../utils/modelValidators");

const Charge = db.sequelize.define(
  "Charge",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    chargeType: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.keys(CHARGE_TYPES), "Invalid charge type"),
      },
    },
    chargeTypeId: {
      type: DataTypes.UUID,
      unique: true,
    },
    lateChargeRate: {
      type: DataTypes.FLOAT,
      validate: {
        max: 100,
        min: 0,
      },
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    metaData: {
      type: DataTypes.JSON,
    },
    isEmailInvoice: {
      type: DataTypes.BOOLEAN,
    },
    description: {
      type: DataTypes.TEXT,
    },
    dueDate: {
      type: DataTypes.DATE,
    },
    invoiceId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
  },
  {
    tableName: "charges",
    paranoid: true,
  }
);

Charge.belongsTo(Flat, {
  as: "flat",
  foreignKey: "flatId",
});

MaintenanceRequest.hasOne(Charge, {
  foreignKey: "chargeTypeId",
  as: "charge",
});

// Charge.sync({ force: true });
// Charge.sync({ alter: true });

module.exports = Charge;
