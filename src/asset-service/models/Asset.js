const { DataTypes } = require("sequelize");
const Administrator = require("../../admin-service/models/Admin");
const Building = require("../../building-service/models/Building");
const {
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
} = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const { acceptedValues } = require("../../utils/modelValidators");

const Asset = db.sequelize.define(
  "Asset",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assetId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(ASSET_CONDITIONS),
          "Invalid Asset Condition"
        ),
      },
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    tableName: "assets",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

Asset.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
});

Asset.belongsTo(Building, {
  foreignKey: "buildingId",
  as: "building",
});

Asset.belongsTo(Administrator, {
  foreignKey: "createdBy",
  as: "admin",
});

// Asset.sync({ force: true });
// Asset.sync({ alter: true });

module.exports = Asset;
