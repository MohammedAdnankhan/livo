const { DataTypes } = require("sequelize");
const db = require("../../database");
const { LEASE_STATUSES } = require("../../config/constants");

const LeaseStatus = db.sequelize.define(
  "LeaseStatus",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    leaseId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(Object.values(LEASE_STATUSES)),
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "lease_statuses",
    paranoid: true,
  }
);

// LeaseStatus.sync({ alter: true });
module.exports = LeaseStatus;
