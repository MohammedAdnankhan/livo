const { DataTypes } = require("sequelize");
const { PAYMENT_STATUSES } = require("../../config/constants");
const db = require("../../database");
const User = require("../../user-service/models/User");
const { acceptedValues } = require("../../utils/modelValidators");
const Charge = require("./Charge");

const Payment = db.sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    chargeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    payStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.keys(PAYMENT_STATUSES),
          "Invalid payment status"
        ),
      },
    },
    metaData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    stripePaymentIntentId: {
      type: DataTypes.STRING,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "payments",
    paranoid: true,
  }
);

Payment.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
});

Payment.belongsTo(Charge, {
  as: "chargeDetails",
  foreignKey: "chargeId",
});

Charge.hasMany(Payment, {
  as: "payments",
  foreignKey: "chargeId",
});

// Payment.sync({ force: true });
// Payment.sync({ alter: true });

module.exports = Payment;
