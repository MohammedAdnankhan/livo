const { DataTypes } = require("sequelize");
const {
  PIXLAB_DOCUMENT_TYPES,
  PIXLAB_SUPPORTED_COUNTRIES,
} = require("../../config/constants");
const db = require("../../database");
const { isPhoneNumber } = require("../../utils/modelValidators");

const Visitor = db.sequelize.define(
  "Visitor",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    countryCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    documentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentExpiry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentExpireMonth: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentIssueState: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentIssueDate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passportNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    additionalDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "visitors",
    paranoid: true,
  }
);

// Visitor.sync({ force: true });
// Visitor.sync({ alter: true });

module.exports = Visitor;
