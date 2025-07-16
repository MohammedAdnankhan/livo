const { DataTypes } = require("sequelize");
const { LANGUAGES } = require("../../config/constants");
const db = require("../../database");
const {
  isPhoneNumber,
  acceptedValues,
} = require("../../utils/modelValidators");

const Owner = db.sequelize.define(
  "Owner",
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
      validate: {
        ...isPhoneNumber(),
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
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
      allowNull: false,
      validate: {
        len: {
          args: [6], //TODO: to be changed later...
          msg: "Password should be at least 6 characters long.",
        },
      },
    },
  },
  {
    tableName: "owners",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["password", "createdAt", "updatedAt"],
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["mobileNumber"],
        where: {
          deletedAt: null,
        },
      },
      {
        unique: true,
        fields: ["email"],
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

// Owner.sync({ force: true });
// Owner.sync({ alter: true });

module.exports = Owner;
