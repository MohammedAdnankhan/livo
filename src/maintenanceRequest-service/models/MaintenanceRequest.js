const { DataTypes } = require("sequelize");
const {
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
  MAINTENANCE_REQUESTED_BY,
} = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const Staff = require("../../staff-service/models/Staff");
const User = require("../../user-service/models/User");

const { acceptedValues } = require("../../utils/modelValidators");
const MaintenanceStatus = require("./MaintenanceStatus");
const MaintenanceCategory = require("../models/MaintenanceCategory");
const MaintenanceProduct = require("./MaintenanceProduct");

const MaintenanceRequest = db.sequelize.define(
  "MaintenanceRequest",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    isBuilding: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isUrgent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    subCategoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    files: {
      type: DataTypes.JSON,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.keys(MAINTENANCE_STATUSES), "Invalid Status"),
      },
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    staffTimeSlot: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    preferredTime: {
      type: DataTypes.JSON, // {first: {start: dateTime, end: dateTime}, second: {start: dateTime, end: dateTime}}
      allowNull: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    generatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(MAINTENANCE_REQUESTED_BY),
          "Invalid Value for column generatedBy"
        ),
      },
    },
  },
  {
    tableName: "maintenance_requests",
    paranoid: true,
    indexes: [
      {
        using: "BTREE",
        fields: ["userId"],
      },
    ],
  }
);
MaintenanceRequest.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
});

Staff.hasMany(MaintenanceRequest, {
  foreignKey: "staffId",
  as: "assignedRequests",
});

MaintenanceRequest.belongsTo(Staff, {
  foreignKey: "staffId",
  as: "staff",
});

MaintenanceRequest.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
  targetKey: "id",
});

MaintenanceRequest.belongsTo(MaintenanceCategory, {
  foreignKey: "categoryId",
  as: "category",
  targetKey: "id",
});

MaintenanceRequest.belongsTo(MaintenanceCategory, {
  foreignKey: "subCategoryId",
  as: "subCategory",
  targetKey: "id",
});

MaintenanceRequest.hasMany(MaintenanceStatus, {
  foreignKey: "maintenanceId",
  targetKey: "id",
  as: "statusDetails",
});

MaintenanceRequest.hasMany(MaintenanceProduct, {
  foreignKey: "maintenanceId",
  targetKey: "id",
  as: "maintenanceProducts",
});

// MaintenanceRequest.sync({ force: true });
//MaintenanceRequest.sync({ alter: true });

module.exports = MaintenanceRequest;
