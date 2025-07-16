const { DataTypes } = require("sequelize");
const db = require("../../database");

const BankDetail = db.sequelize.define(
  "BankDetail",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    masterUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    accountHolderName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bankName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    swiftCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    iban: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "bank_details",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    indexes: [
      {
        fields: ["masterUserId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

// BankDetail.sync({ force: true });
// BankDetail.sync({ alter: true });

module.exports = BankDetail;
