const { DataTypes } = require("sequelize");
const City = require("../../city-service/models/City");
const db = require("../../database");
const { minLength } = require("../../utils/modelValidators");
const { LOCALITY_LANGUAGE_KEYS } = require("../configs/constants");

const Locality = db.sequelize.define(
  "Locality",
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
      unique: "LocalityAndCityIdIndex",
      validate: {
        ...minLength(2),
      },
    },
    name_ar: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...minLength(2),
      },
    },
    cityId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "LocalityAndCityIdIndex",
    },
  },
  {
    tableName: "localities",
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
            ...LOCALITY_LANGUAGE_KEYS,
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
      },
    },
  }
);

Locality.belongsTo(City, {
  as: "city",
  foreignKey: "cityId",
});

// Locality.sync({ force: true });
// Locality.sync({ alter: true });

module.exports = Locality;
