const { DataTypes } = require("sequelize");
const User = require("../../user-service/models/User");
const db = require("../../database");
const { ACTION_TYPES, SOURCE_TYPES } = require("../../config/constants");
const { acceptedValues } = require("../../utils/modelValidators");

const UserNotification = db.sequelize.define(
  "UserNotification",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    actionType: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.keys(ACTION_TYPES), "Invalid action type"),
      },
    },
    sourceType: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.values(SOURCE_TYPES), "Invalid Source type"),
      },
      allowNull: false,
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    generatedBy: {
      type: DataTypes.UUID,
    },
    generatedFor: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metaData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "user_notifications",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

UserNotification.belongsTo(User, {
  as: "resident",
  foreignKey: "generatedFor",
});

// UserNotification.sync({ force: true });
// UserNotification.sync({ alter: true });

module.exports = UserNotification;
