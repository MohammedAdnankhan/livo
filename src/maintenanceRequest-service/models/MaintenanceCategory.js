const { DataTypes } = require("sequelize");
const db = require("../../database");
const { minLength } = require("../../utils/modelValidators");
const MaintenanceCategory = db.sequelize.define(
  "MaintenanceCategory",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "maintenance_categories",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt", "propertyId"],
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["name_en", "propertyId"],
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

// MaintenanceCategory.sync({ force: true });
// MaintenanceCategory.sync({ alter: true });

module.exports = MaintenanceCategory;
