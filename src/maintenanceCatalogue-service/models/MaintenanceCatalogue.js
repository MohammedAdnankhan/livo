const { DataTypes } = require("sequelize");
const db = require("../../database");
const MaintenanceRequest = require("../../maintenanceRequest-service/models/MaintenanceRequest");
const MaintenanceChargeCatalogue = require("./MaintenanceChargeCatalogue");

const MaintenanceCatalogue = db.sequelize.define(
  "MaintenanceCatalogue",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    maintenanceId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "maintenanceAndChargeCatalogueId",
    },
    maintenanceChargeCatalogueId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "maintenanceAndChargeCatalogueId",
    },
  },
  {
    tableName: "maintenance_catalogues",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

MaintenanceCatalogue.belongsTo(MaintenanceRequest, {
  foreignKey: "maintenanceId",
  as: "maintenanceRequest",
});

MaintenanceCatalogue.belongsTo(MaintenanceChargeCatalogue, {
  foreignKey: "maintenanceChargeCatalogueId",
  as: "charge",
});

// MaintenanceCatalogue.sync({ force: true });
// MaintenanceCatalogue.sync({ alter: true });

module.exports = MaintenanceCatalogue;
