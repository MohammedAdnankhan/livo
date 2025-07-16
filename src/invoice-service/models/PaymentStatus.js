const { DataTypes } = require("sequelize");
const db = require("../../database");

const PaymentStatus = db.sequelize.define(
  "PaymentStatus",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amountPaid: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    dueAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    paymentMode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paidDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "payment_statuses",
    paranoid: true,
  }
);

// PaymentStatus.sync({ force: true });
// PaymentStatus.sync({ alter: true });

module.exports = PaymentStatus;
