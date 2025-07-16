const { DataTypes } = require("sequelize");
const { DEVICE_TYPES } = require("../../config/constants");
const db = require("../../database");
const Admin = require("../../admin-service/models/Admin");

const adminPushDevice = db.sequelize.define(
  "adminPushDevice",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
  },
  {
    tableName: "admin_push_devices",
    paranoid: true,
  }
);

adminPushDevice.belongsTo(Admin, {
  as: "admin",
  foreignKey: "adminId",
});

// adminPushDevice.sync({ force: true });
// adminPushDevice.sync({ alter: true });

module.exports = adminPushDevice;
