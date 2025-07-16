const { DataTypes } = require("sequelize");
const db = require("../../database");
const FlatContract = require("./FlatContract");

const ContractPayment = db.sequelize.define(
  "ContractPayment",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    contractId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE, // utc with offset +5:30
      allowNull: false,
    },
    discount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "contract_payments",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

// ContractPayment.sync({ force: true });
// ContractPayment.sync({ alter: true });

module.exports = ContractPayment;
