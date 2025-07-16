const { DataTypes } = require("sequelize");
const db = require("../../database");
const { VISITOR_TYPE_LANGUAGE_KEYS } = require("../configs/constants");

const VisitorType = db.sequelize.define(
  "VisitorType",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    category_en: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category_ar: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_en: {
      type: DataTypes.STRING,
      allownull: true,
    },
    company_ar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 9,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "visitor_types",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    scopes: {
      languageHelper: {
        attributes: {
          exclude: [
            ...VISITOR_TYPE_LANGUAGE_KEYS,
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["category_en", "company_en", "propertyId"],
        name: "unique_category_en_company_en_propertyId",
        where: {
          deletedAt: null,
        },
      },
      {
        unique: true,
        fields: ["category_ar", "company_ar", "propertyId"],
        name: "unique_category_ar_company_ar_propertyId",
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

// VisitorType.sync({ force: true });
// VisitorType.sync({ alter: true });

module.exports = VisitorType;
