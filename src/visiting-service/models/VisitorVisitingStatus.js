const { DataTypes } = require("sequelize");
const { VISITOR_STATUSES } = require("../../config/constants");
const db = require("../../database");
const VisitorVisiting = require("./VisitorVisiting");

const VisitorVisitingStatus = db.sequelize.define(
  "VisitorVisitingStatus",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    status: {
      type: DataTypes.ENUM(Object.values(VISITOR_STATUSES)),
      allowNull: false,
    },
    visitingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    guardId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "visitor_visiting_statuses",
    paranoid: true,
    indexes: [
      {
        using: "BTREE",
        fields: ["visitingId"],
      },
    ],
  }
);

VisitorVisitingStatus.belongsTo(VisitorVisiting, {
  foreignKey: "visitingId",
  as: "visiting",
});

VisitorVisiting.hasMany(VisitorVisitingStatus, {
  foreignKey: "visitingId",
  as: "visitingStatuses",
});

// VisitorVisitingStatus.sync({ force: true });
// VisitorVisitingStatus.sync({ alter: true });

module.exports = VisitorVisitingStatus;
