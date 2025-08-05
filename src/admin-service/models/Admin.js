const { DataTypes } = require("sequelize");
const { ADMIN_ROLES, ADMIN_ACTION_TYPES } = require("../../config/constants");
const db = require("../../database");
const Property = require("../../property-service/models/Property");
const {
  acceptedValues,
  isPhoneNumber,
  minLength,
} = require("../../utils/modelValidators");

const Administrator = db.sequelize.define(
  "Administrator",
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          args: true,
          msg: "Please enter a valid Email.",
        },
      },
    },
    countryCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
    },
    role: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.values(ADMIN_ROLES), "Invalid role type"),
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...minLength(6),
      },
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notificationEnabled: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: (function () {
        const notification = {};
        Object.keys(ADMIN_ACTION_TYPES).forEach((action) => {
          notification[action] = true;
        });
        return notification;
      })(),
    },
  },
  {
    tableName: "administrators",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["password", "createdAt", "deletedAt", "updatedAt"],
      },
    },
  }
);

Administrator.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
});

// We'll define the relationship with Tenant after both models are loaded
// to avoid circular dependencies

// Administrator.sync({ force: true });
// Administrator.sync({ alter: true });

module.exports = Administrator;
