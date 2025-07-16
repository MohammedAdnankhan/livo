const { DataTypes } = require("sequelize");
const { FLAT_FURNISHINGS, RENTAL_TYPES } = require("../../config/constants");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");
const { SUB_FLAT_LANGUAGE_KEYS } = require("../configs/constants");
const Flat = require("../../flat-service/models/Flat");

const SubFlat = db.sequelize.define(
  "SubFlat",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    subFlatId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    name_en: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name_ar: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    furnishing: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(FLAT_FURNISHINGS),
          "Invalid furnishing type"
        ),
      },
    },
    rentalType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(Object.values(RENTAL_TYPES), "Invalid rental type"),
      },
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "sub_flats",
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
            ...SUB_FLAT_LANGUAGE_KEYS,
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
      },
    },
    indexes: [
      {
        fields: ["name_en", "flatId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

SubFlat.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
  targetKey: "id",
});

Flat.hasMany(SubFlat, {
  foreignKey: "flatId",
  as: "subFlats",
  targetKey: "id",
});

// SubFlat.sync({ alter: true });
// SubFlat.sync({ force: true }).then(() => {
//   db.sequelize.queryInterface.addIndex("sub_flats", ["flatId", "name_en"], {
//     unique: true,
//     where: {
//       deletedAt: null,
//     },
//   });
// });

module.exports = SubFlat;
