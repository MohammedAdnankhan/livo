const { DataTypes } = require("sequelize");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");
const { SCHEDULING_TYPES } = require("../../config/constants");
const LeaseReminder = db.sequelize.define(
  "LeaseReminder",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    reminderId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    leaseId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    cronId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cronTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    smsTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    smsBody: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    scheduledFor: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(SCHEDULING_TYPES),
          "Invalid action type"
        ),
      },
    },
  },
  {
    tableName: "lease_reminders",
    paranoid: true,
  }
);
// LeaseReminder.sync({ alter: true });
module.exports = LeaseReminder;
