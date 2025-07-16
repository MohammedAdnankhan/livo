const { DataTypes } = require("sequelize");
const { DEVICE_TYPES } = require("../../config/constants");
const db = require("../../database");
const User = require("../../user-service/models/User");

const PushDevice = db.sequelize.define(
  "PushDevice",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    deviceType: {
      type: DataTypes.ENUM(Object.values(DEVICE_TYPES)),
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
  },
  {
    tableName: "push_devices",
    paranoid: true,
  }
);

PushDevice.belongsTo(User, {
  as: "resident",
  foreignKey: "userId",
});

// PushDevice.sync({ force: true });
// PushDevice.sync({ alter: true });

module.exports = PushDevice;
