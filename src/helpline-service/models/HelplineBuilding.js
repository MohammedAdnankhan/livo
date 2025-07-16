const { DataTypes } = require("sequelize");
const Building = require("../../building-service/models/Building");
const db = require("../../database");

const HelplineBuilding = db.sequelize.define(
  "HelplineBuilding",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    helplineId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "helplineIdAndBuildingIdIndex",
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "helplineIdAndBuildingIdIndex",
    },
  },
  {
    tableName: "helpline_buildings",
    paranoid: true,
    // defaultScope: {
    //   attributes: {
    //     exclude: ["createdAt", "updatedAt", "deletedAt"],
    //   },
    // },
  }
);

HelplineBuilding.belongsTo(Building, {
  as: "building",
  foreignKey: "buildingId",
});

// HelplineBuilding.sync({ force: true });
// HelplineBuilding.sync({ alter: true });

module.exports = HelplineBuilding;
