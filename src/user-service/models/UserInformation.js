const { DataTypes } = require("sequelize");
const { ACTION_TYPES } = require("../../config/constants");
const db = require("../../database");
const User = require("./User");

const UserInformation = db.sequelize.define(
  "UserInformation",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isEmailPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isMobileNumberPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isAddressPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notificationEnabled: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: (function () {
        const notification = {};
        Object.keys(ACTION_TYPES).forEach((action) => {
          notification[action] = true;
        });
        return notification;
      })(),
    },
    customerId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "user_informations",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: [
          "createdAt",
          "updatedAt",
          "deletedAt",
          "notificationEnabled",
          "customerId",
        ],
      },
    },
    indexes: [
      {
        fields: ["userId", "customerId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

UserInformation.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

module.exports = UserInformation;
