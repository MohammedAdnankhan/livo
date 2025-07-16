const { DataTypes } = require("sequelize");
const db = require("../../database");

const ClientMapping = db.sequelize.define(
  "ClientMapping",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userIdType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userIdValue: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "client_mappings",
    paranoid: true,
    scopes: {
      featureDetails: {
        attributes: {
          exclude: ["id", "createdAt", "updatedAt", "deletedAt"],
        },
      },
    },
  }
);

// ClientMapping.sync({ force: true });
// ClientMapping.sync({ alter: true });

module.exports = ClientMapping;
