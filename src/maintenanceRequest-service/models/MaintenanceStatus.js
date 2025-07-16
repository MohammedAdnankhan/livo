const { DataTypes } = require("sequelize");
const { MAINTENANCE_STATUSES } = require("../../config/constants");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");

const MaintenanceStatus = db.sequelize.define(
  "MaintenanceStatus",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    maintenanceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.keys(MAINTENANCE_STATUSES), "Invalid Status"),
      },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    files: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metaData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "maintenance_statuses",
    paranoid: true,
  }
);

// MaintenanceStatus.sync({ force: true });
// MaintenanceStatus.sync({ alter: true });

module.exports = MaintenanceStatus;
