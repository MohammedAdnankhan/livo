const { DataTypes } = require("sequelize");
const db = require("../../database");
const { SIDEBAR_VALUES } = require("../../config/constants");
const PropertyFeature = db.sequelize.define(
  "PropertyFeature",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    communityManagement: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    dashboard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    invoiceManagement: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    serviceManagement: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    visitorManagement: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isMaintenanceFree: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isSignupApprovalRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    approvalDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isCrmPushRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    crmDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adminSidebar: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: Object.values(SIDEBAR_VALUES),
    },
    isApiAccessible: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    clientSecret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "property_features",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: [
          "id",
          "createdAt",
          "updatedAt",
          "deletedAt",
          "crmDetails",
          "approvalDetails",
        ],
      },
    },
    scopes: {
      featureDetails: {
        attributes: {
          exclude: ["id", "createdAt", "updatedAt", "deletedAt"],
        },
      },
    },
  }
);

// PropertyFeature.sync({ force: true });
// PropertyFeature.sync({ alter: true });

module.exports = PropertyFeature;
