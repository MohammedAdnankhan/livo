const { DataTypes } = require("sequelize");
const db = require("../../database");
const { FLAT_USAGE, PAYMENT_FREQUENCIES } = require("../../config/constants");
const { acceptedValues } = require("../../utils/modelValidators");
const LeaseStatus = require("./LeaseStatus");
const LeaseTerm = require("./LeaseTerm");
const LeaseAmenity = require("./LeaseAmenity");

const Lease = db.sequelize.define(
  "Lease",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    leaseId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    subFlatId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    masterUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    flatUsage: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.values(FLAT_USAGE), "Invalid Usage Type"),
      },
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    moveInDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    moveOutDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    securityDeposit: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    rentAmount: {
      type: DataTypes.FLOAT,
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
      allowNull: true,
    },
    noticePeriod: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    discount: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "leases",
    paranoid: true,
  }
);

Lease.hasMany(LeaseStatus, {
  foreignKey: "leaseId",
  targetKey: "id",
  as: "statuses",
});

Lease.hasMany(LeaseTerm, {
  foreignKey: "leaseId",
  targetKey: "id",
  as: "terms",
});

Lease.hasMany(LeaseAmenity, {
  foreignKey: "leaseId",
  targetKey: "id",
  as: "amenities",
});

// Lease.sync({ alter: true });

module.exports = Lease;
