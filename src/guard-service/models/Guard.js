const { DataTypes } = require("sequelize");
const db = require("../../database");
const Property = require("../../property-service/models/Property");
const { isPhoneNumber } = require("../../utils/modelValidators");
const GuardBuilding = require("./GuardBuilding");
const { acceptedValues } = require("../../utils/modelValidators");
const { GENDERS } = require("../../config/constants");

const Guard = db.sequelize.define(
  "Guard",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userName: {
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
      validate: {
        ...isPhoneNumber(),
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [6],
          msg: "Password should be at least 6 characters long.",
        },
      },
    },
    alternateContact: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    pocContact: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.JSON),
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(Object.values(GENDERS), "Invalid Gender"),
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "guards",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    indexes: [
      {
        fields: ["mobileNumber"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        fields: ["userName"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
    hooks: {
      afterDestroy: async function (instance, options) {
        await GuardBuilding.destroy({
          where: {
            guardId: instance.dataValues.id,
          },
          force: true,
        });
      },
    },
  }
);

Guard.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
});

Guard.hasMany(GuardBuilding, {
  as: "guardBuildings",
  foreignKey: "guardId",
});

// Guard.sync({ force: true });
// Guard.sync({ alter: true });

module.exports = Guard;
