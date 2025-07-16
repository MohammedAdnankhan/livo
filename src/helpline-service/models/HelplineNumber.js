const { DataTypes } = require("sequelize");
const db = require("../../database");
const { minLength } = require("../../utils/modelValidators");
const HelplineBuilding = require("./HelplineBuilding");

const HelplineNumber = db.sequelize.define(
  "HelplineNumber",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name_en: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
    countryCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contactNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "helpline_numbers",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    hooks: {
      afterDestroy: async function (instance, options) {
        await HelplineBuilding.destroy({
          where: {
            helplineId: instance.dataValues.id,
          },
          force: true,
        });
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

HelplineNumber.hasMany(HelplineBuilding, {
  as: "helplineBuildings",
  foreignKey: "helplineId",
});

// HelplineNumber.sync({ force: true });
// HelplineNumber.sync({ alter: true });

module.exports = HelplineNumber;
