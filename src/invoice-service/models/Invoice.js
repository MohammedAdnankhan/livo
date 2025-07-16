const { DataTypes } = require("sequelize");
const db = require("../../database");

const Invoice = db.sequelize.define(
  "Invoice",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    invoiceFor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invoiceDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invoiceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userInfo: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    masterUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    invoiceType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    products: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    tagIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      defaultValue: [],
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    paymentMode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    invoiceUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    termsConditions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    discountType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    discountValue: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    taxValue: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    netAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    subTotalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    depositedAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    finalAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "invoices",
    paranoid: true,
  }
);

// Invoice.sync({ force: true });
// Invoice.sync({ alter: true });

module.exports = Invoice;
