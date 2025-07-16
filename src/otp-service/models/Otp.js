const { DataTypes } = require("sequelize");
const db = require("../../database");

const Otp = db.sequelize.define(
  "Otp",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    secretKey: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileNumber: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: "otps",
    paranoid: true,
  }
);

// Otp.sync({ force: true });

module.exports = Otp;
