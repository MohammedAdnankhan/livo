const { DataTypes } = require("sequelize");
const {
  FLAT_USAGE,
  PAYMENT_FREQUENCIES,
  DISCOUNT_APPLICABILITY,
} = require("../../config/constants");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");
const FlatContract = require("./FlatContract");

const ContractRenewal = db.sequelize.define(
  "ContractRenewal",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    renewalRequestId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    contractId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    newContractId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    flatUsage: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(Object.values(FLAT_USAGE), "Invalid Usage Type"),
      },
    },
    contractImage: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    contractEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    moveOutDate: {
      type: DataTypes.DATE,
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

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rentAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    isDiscountRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    discount: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        amount: 0,
        grace: 0,
      },
    },
    discountPeriod: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    userDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    applicableOn: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(DISCOUNT_APPLICABILITY),
          "Invalid Input Value"
        ),
      },
    },
  },
  {
    tableName: "contract_renewals",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

ContractRenewal.belongsTo(FlatContract, {
  foreignKey: "contractId",
  as: "contract",
});

// ContractRenewal.sync({ force: true });
// ContractRenewal.sync({ alter: true });
module.exports = ContractRenewal;
