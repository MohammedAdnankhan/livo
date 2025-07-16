const { DataTypes } = require("sequelize");
const db = require("../../database");

const LeaseAmenity = db.sequelize.define(
  "LeaseAmenity",
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
    itemName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    itemIds: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "lease_amenities",
    paranoid: true,
  }
);

module.exports = LeaseAmenity;
