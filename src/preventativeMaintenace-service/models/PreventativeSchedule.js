const { DataTypes } = require("sequelize");
const db = require("../../database");

const PreventativeSchedule = db.sequelize.define(
  "PreventativeSchedule",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    scheduleId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    preventativeMaintenanceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "preventative_schedules",
    paranoid: true,
  }
);

// PreventativeSchedule.sync({ force: true });
// PreventativeSchedule.sync({ alter: true });

module.exports = PreventativeSchedule;
