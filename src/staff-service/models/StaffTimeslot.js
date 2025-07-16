const { DataTypes } = require("sequelize");
const { STAFF_AVAILABILITY_STATUS } = require("../../config/constants");
const db = require("../../database");
const Timeslot = require("../../timeslot-service/models/Timeslot");
const { acceptedValues } = require("../../utils/modelValidators");

const StaffTimeslot = db.sequelize.define(
  "StaffTimeslot",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "staffIdAndTimeSlotIdIndex",
    },
    timeSlotId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "staffIdAndTimeSlotIdIndex",
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(STAFF_AVAILABILITY_STATUS),
          "Invalid Availability Status"
        ),
      },
    },
    files: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metaData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "staff_timeslots",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["files", "metaData", "createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

StaffTimeslot.belongsTo(Timeslot, {
  foreignKey: "timeSlotId",
  targetKey: "id",
  as: "timeSlot",
});

// StaffTimeslot.sync({ force: true });
// StaffTimeslot.sync({ alter: true });

module.exports = StaffTimeslot;
