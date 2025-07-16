const { DataTypes } = require("sequelize");
const Building = require("../../building-service/models/Building");
const db = require("../../database");

const GuardBuilding = db.sequelize.define(
  "GuardBuilding",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    guardId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "guardIdAndBuildingIdIndex",
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "guardIdAndBuildingIdIndex",
    },
  },
  {
    tableName: "guard_buildings",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

GuardBuilding.belongsTo(Building, {
  as: "building",
  foreignKey: "buildingId",
});

// GuardBuilding.sync({ force: true });
// GuardBuilding.sync({ alter: true });

module.exports = GuardBuilding;
