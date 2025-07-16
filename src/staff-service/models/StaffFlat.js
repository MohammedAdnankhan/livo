const { DataTypes } = require("sequelize");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const Staff = require("./Staff");

const StaffFlat = db.sequelize.define(
  "StaffFlat",
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
      unique: "staffIdAndFlatIdIndex",
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "staffIdAndFlatIdIndex",
    },
  },
  {
    tableName: "staff_flats",
    paranoid: true,
  }
);

StaffFlat.belongsTo(Staff, {
  foreignKey: "staffId",
  as: "staff",
});

StaffFlat.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
});

Staff.hasMany(StaffFlat, {
  foreignKey: "staffId",
  as: "flatsAssociated",
});

// StaffFlat.sync({ force: true });
// StaffFlat.sync({ alter: true });

module.exports = StaffFlat;
