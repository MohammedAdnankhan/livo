const { DataTypes } = require("sequelize");
const db = require("../../database");

const Timeslot = db.sequelize.define(
  "Timeslot",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      unique: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "time_slots",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

// Timeslot.sync({ force: true });
// Timeslot.sync({ alter: true });

module.exports = Timeslot;
