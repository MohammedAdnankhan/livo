const { DataTypes } = require("sequelize");
const { BUILDING_TYPES } = require("../../config/constants");
const db = require("../../database");
const Locality = require("../../locality-service/models/Locality");
const Property = require("../../property-service/models/Property");
const { minLength, acceptedValues } = require("../../utils/modelValidators");
const { BUILDING_LANGUAGE_KEYS } = require("../configs/constants");

const Building = db.sequelize.define(
  "Building",
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
    localityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    address_en: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address_ar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pinCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    location: {
      type: DataTypes.GEOMETRY("POINT"),
      allowNull: true,
    },
    buildingType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(BUILDING_TYPES),
          "Invalid Building Type"
        ),
      },
    },
    governmentPropertyId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    description_en: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description_ar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    primaryContact: {
      type: DataTypes.JSON,
      defaultValue: {
        name: null,
        mobileNumber: null,
        email: null,
      },
    },
    amenities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    tableName: "buildings",
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
            ...BUILDING_LANGUAGE_KEYS,
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
      },
    },
    indexes: [
      {
        fields: ["name_en", "propertyId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        fields: ["governmentPropertyId", "propertyId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
    hooks: {
      beforeValidate: function (instance, options) {
        const { name_en, name_ar } = instance.dataValues;
        if (!name_ar) {
          instance.dataValues.name_ar = name_en + "_ar";
        }
        if (name_ar && name_ar.includes("_ar")) {
          const name = name_ar.split("_")[0];
          if (name !== name_en) {
            instance.dataValues.name_ar = name_en + "_ar";
          }
        }
      },
    },
  }
);

Building.belongsTo(Locality, {
  foreignKey: "localityId",
  as: "locality",
});

Building.belongsTo(Property, {
  foreignKey: "propertyId",
  as: "property",
});

// Building.sync({ alter: true });
module.exports = Building;
