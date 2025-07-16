const { DataTypes } = require("sequelize");
const db = require("../../database");

const Payment = db.sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    tableName: "payments",
    paranoid: true,
  }
);

// Payment.sync({ force: true });
// Payment.sync({ alter: true });

module.exports = Payment;
