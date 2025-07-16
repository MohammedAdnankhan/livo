const { DataTypes } = require("sequelize");
const { DEVICE_TYPES } = require("../../config/constants");
const db = require("../../database");
const Owner = require("../../owner-service/models/Owner");

const OwnerPushDevice = db.sequelize.define(
  "OwnerPushDevice",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    ownerId: {
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
    },
  },
  {
    tableName: "owner_push_devices",
    paranoid: true,
    indexes: [
      {
        fields: ["token"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

OwnerPushDevice.belongsTo(Owner, {
  as: "owner",
  foreignKey: "ownerId",
});

// OwnerPushDevice.sync({ force: true });
// OwnerPushDevice.sync({ alter: true });

module.exports = OwnerPushDevice;
