const { DataTypes } = require("sequelize");
const { LANGUAGES, USER_ROLES } = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const {
  isPhoneNumber,
  acceptedValues,
} = require("../../utils/modelValidators");

const User = db.sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: {
          args: true,
          msg: "Please enter a valid Email.",
        },
      },
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    countryCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.values(USER_ROLES), "Invalid user role"),
      },
      defaultValue: USER_ROLES.RESIDENT,
    },
    language: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.values(LANGUAGES), "Invalid language"),
      },
      defaultValue: LANGUAGES.EN,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [6],
          msg: "Password should be at least 6 characters long.",
        },
      },
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    subFlatId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    requestedFlat: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    about: {
      type: DataTypes.STRING,
    },
    emiratesId: {
      type: DataTypes.STRING,
    },
    familyMemberId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["password", "createdAt", "updatedAt"],
      },
    },
    indexes: [
      {
        fields: ["email"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        fields: ["mobileNumber"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        fields: ["flatId", "familyMemberId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

User.belongsTo(Flat, {
  as: "flat",
  foreignKey: "flatId",
});

User.belongsTo(Flat, {
  as: "flatRequested",
  foreignKey: "requestedFlat",
});

Flat.hasOne(User, {
  as: "user",
  foreignKey: "flatId",
});

// User.sync({ alter: true });
module.exports = User;
