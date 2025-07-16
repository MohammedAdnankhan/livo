const { DataTypes } = require("sequelize");
const db = require("../../database");

const PreapprovedVisiting = db.sequelize.define(
  "PreapprovedVisiting",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },

    visitorCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    inTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    outTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    isFrequent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "preapproved_visitings",
    paranoid: true,
  }
);

// PreapprovedVisiting.sync({ force: true });
// PreapprovedVisiting.sync({ alter: true })

module.exports = PreapprovedVisiting;
