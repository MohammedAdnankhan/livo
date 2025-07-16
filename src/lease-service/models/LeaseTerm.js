const { DataTypes } = require("sequelize");
const db = require("../../database");

const LeaseTerm = db.sequelize.define(
  "LeaseTerm",
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
    term: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: "lease_terms",
    paranoid: true,
  }
);

module.exports = LeaseTerm;
