const { DataTypes } = require("sequelize");
const Admin = require("../../admin-service/models/Admin");
const db = require("../../database");
const {
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
} = require("../../config/constants");
const { acceptedValues } = require("../../utils/modelValidators");

const adminNotification = db.sequelize.define(
  "AdminNotification",
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
        ...acceptedValues(
          Object.keys(ADMIN_ACTION_TYPES),
          "Invalid action type"
        ),
      },
    },
    sourceType: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(
          Object.values(ADMIN_SOURCE_TYPES),
          "Invalid Source type"
        ),
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
    tableName: "admin_notifications",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

adminNotification.belongsTo(Admin, {
  as: "admin",
  foreignKey: "generatedFor",
});

// adminNotification.sync({ force: true });
// adminNotification.sync({ alter: true });

module.exports = adminNotification;
