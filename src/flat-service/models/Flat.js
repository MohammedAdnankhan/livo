const { DataTypes } = require("sequelize");
const Building = require("../../building-service/models/Building");
const { FLAT_TYPES } = require("../../config/constants");
const db = require("../../database");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const { acceptedValues } = require("../../utils/modelValidators");
const { FLAT_LANGUAGE_KEYS } = require("../configs/constants");

const Flat = db.sequelize.define(
  "Flat",
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
    },
    name_ar: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    flatType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(Object.values(FLAT_TYPES), "Invalid Flat Type"),
      },
    },
    size: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    unitId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ownerId: {
      type: DataTypes.UUID,
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
    amenities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
  },
  {
    tableName: "flats",
    paranoid: true,
    indexes: [
      {
        fields: ["name_en", "buildingId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        fields: ["unitId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    scopes: {
      languageHelper: {
        attributes: {
          exclude: [
            ...FLAT_LANGUAGE_KEYS,
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
      },
    },
    hooks: {
      afterDestroy: async function (instance, options) {
        await instance.flatInfo.destroy();
        await instance.SubFLat.destroy();
      },
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

Flat.belongsTo(Building, {
  foreignKey: "buildingId",
  as: "building",
});

Building.hasMany(Flat, {
  foreignKey: "buildingId",
  as: "flats",
});

Flat.belongsTo(MasterUser, {
  foreignKey: "ownerId",
  as: "owner",
});

MasterUser.hasMany(Flat, {
  foreignKey: "ownerId",
  as: "ownedFlats",
});

module.exports = Flat;
