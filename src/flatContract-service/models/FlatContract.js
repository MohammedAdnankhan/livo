const { DataTypes } = require("sequelize");
const { FLAT_USAGE, PAYMENT_FREQUENCIES } = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const { acceptedValues } = require("../../utils/modelValidators");
const ContractPayment = require("./ContractPayment");
const moment = require("moment-timezone");
const Discount = require("./Discount");

const FlatContract = db.sequelize.define(
  "FlatContract",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    contractId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    masterUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isOwnerResiding: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    flatUsage: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.values(FLAT_USAGE), "Invalid Usage Type"),
      },
    },
    contractImage: {
      type: DataTypes.ARRAY(DataTypes.JSON),
      allowNull: true,
    },
    contractStartDate: {
      type: DataTypes.DATE, // utc with offset +5:30 | inclusive
      allowNull: true,
    },
    contractEndDate: {
      type: DataTypes.DATE, // utc with offset +5:30 | inclusive
      allowNull: true,
      get() {
        const grace = this.getDataValue("grace");
        const contractEndDate = this.getDataValue("contractEndDate");
        return contractEndDate
          ? grace
            ? moment(contractEndDate).add(grace, "month").toDate()
            : contractEndDate
          : null;
      },
    },
    moveInDate: {
      type: DataTypes.DATE, // utc with offset +5:30 | inclusive
      allowNull: true,
    },
    moveOutDate: {
      type: DataTypes.DATE, // utc with offset +5:30 | inclusive
      allowNull: true,
      get() {
        const grace = this.getDataValue("grace");
        const moveOutDate = this.getDataValue("moveOutDate");
        return moveOutDate
          ? grace
            ? moment(moveOutDate).add(grace, "month").toDate()
            : moveOutDate
          : null;
      },
    },
    isValid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    expiryReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expiredAt: {
      type: DataTypes.DATE, // utc with offset +5:30
      allowNull: true,
    },
    securityDeposit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    activationFee: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    paymentFrequency: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(PAYMENT_FREQUENCIES),
          "Invalid Payment Frequency Type"
        ),
      },
    },
    paymentMode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    noticePeriod: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    grace: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isExpired: {
      type: DataTypes.VIRTUAL,
      get() {
        if (this.isOwnerResiding) {
          if (this.contractEndDate) {
            return (
              new Date() >
                moment(this.contractEndDate)
                  .add(this.grace, "month")
                  .toDate() || !this.isValid
            );
          } else {
            return false;
          }
        } else {
          return (
            new Date() >
              moment(this.contractEndDate).add(this.grace, "month").toDate() ||
            !this.isValid
          );
        }
      },
    },
  },
  {
    tableName: "flat_contracts",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

FlatContract.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
});

FlatContract.hasOne(Discount, {
  foreignKey: "contractId",
  as: "discount",
});

FlatContract.belongsTo(MasterUser, {
  foreignKey: "masterUserId",
  as: "resident",
});

MasterUser.hasMany(FlatContract, {
  foreignKey: "masterUserId",
  as: "contractDetails",
});

Flat.hasMany(FlatContract, {
  foreignKey: "flatId",
  as: "contractDetails",
});

FlatContract.hasMany(ContractPayment, {
  foreignKey: "contractId",
  as: "contractPayments",
});

module.exports = FlatContract;
