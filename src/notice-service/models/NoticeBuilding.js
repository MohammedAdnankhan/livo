const { DataTypes } = require("sequelize");
const Building = require("../../building-service/models/Building");
const db = require("../../database");

const NoticeBuilding = db.sequelize.define(
  "NoticeBuilding",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    noticeId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "noticeIdAndBuildingIdIndex",
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "noticeIdAndBuildingIdIndex",
    },
  },
  {
    tableName: "notice_buildings",
    paranoid: true,
    // defaultScope: {
    //   attributes: {
    //     exclude: ["createdAt", "updatedAt", "deletedAt"],
    //   },
    // },
  }
);

NoticeBuilding.belongsTo(Building, {
  as: "building",
  foreignKey: "buildingId",
});

// NoticeBuilding.sync({ force: true });
// NoticeBuilding.sync({ alter: true });

module.exports = NoticeBuilding;
