const { DataTypes } = require("sequelize");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const User = require("../../user-service/models/User");
const { minLength } = require("../../utils/modelValidators");
const Visitor = require("../../visitor-service/models/Visitor");
const VisitorType = require("../../visitor-service/models/VisitorType");
const PreapprovedVisiting = require("./PreapprovedVisiting");

const VisitorVisiting = db.sequelize.define(
  "VisitorVisiting",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    visitorTypeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    visitorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    residentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    preapprovedId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...minLength(2),
      },
    },

    visitorsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },

    leavePackage: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    metaData: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    brokerDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    salesAdvisor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "visitor_visitings",
    paranoid: true,
    indexes: [
      {
        using: "BTREE",
        fields: ["visitorId"],
      },
      {
        using: "BTREE",
        fields: ["visitorTypeId"],
      },
      {
        using: "BTREE",
        fields: ["flatId"],
      },
      {
        using: "BTREE",
        fields: ["residentId"],
      },
    ],
  }
);

VisitorVisiting.belongsTo(Visitor, {
  foreignKey: "visitorId",
  as: "visitor",
});

VisitorVisiting.belongsTo(VisitorType, {
  foreignKey: "visitorTypeId",
  as: "visitorType",
});

VisitorVisiting.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
});

VisitorVisiting.belongsTo(PreapprovedVisiting, {
  foreignKey: "preapprovedId",
  as: "preapprovedDetails",
});

VisitorVisiting.belongsTo(User, {
  foreignKey: "residentId",
  as: "resident",
});

// VisitorVisiting.sync({ force: true });
// VisitorVisiting.sync({ alter: true });

module.exports = VisitorVisiting;
