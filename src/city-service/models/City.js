const { DataTypes } = require("sequelize");
const db = require("../../database");
const { minLength } = require("../../utils/modelValidators");
const { CITY_LANGUAGE_KEYS } = require("../configs/constants");

const City = db.sequelize.define(
  "City",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    name_en: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "cityAndCountryIndex",
      validate: {
        ...minLength(2),
      },
    },
    name_ar: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "cityAndCountryIndexArabic",
      validate: {
        ...minLength(2),
      },
    },
    country_en: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "cityAndCountryIndex",
      validate: {
        ...minLength(2),
      },
    },
    country_ar: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "cityAndCountryIndexArabic",
      validate: {
        ...minLength(2),
      },
    },
  },
  {
    tableName: "cities",
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
            ...CITY_LANGUAGE_KEYS,
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
      },
    },
  }
);

// City.sync({ force: true })
// City.sync({ alter: true })

module.exports = City;
