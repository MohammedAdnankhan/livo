const { DataTypes } = require("sequelize");
const Administrator = require("../../admin-service/models/Admin");
const Asset = require("../../asset-service/models/Asset");
const Building = require("../../building-service/models/Building");
const {
  PPM_TYPES,
  PPM_PRIORITIES,
  PPM_FREQUENCIES,
} = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const { acceptedValues } = require("../../utils/modelValidators");
const { describeCron } = require("../../utils/utility");
const PreventativeSchedule = require("./PreventativeSchedule");

const PreventativeMaintenance = db.sequelize.define(
  "PreventativeMaintenance",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    pmId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.values(PPM_TYPES), "Invalid PPM type"),
      },
      unique: "typeAndTypeIdIndex",
    },
    typeId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "typeAndTypeIdIndex",
    },
    priority: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(PPM_PRIORITIES),
          "Invalid PPM priority"
        ),
      },
    },
    frequency: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(PPM_FREQUENCIES),
          "Invalid PPM Frequency"
        ),
      },
    },
    cron: {
      type: DataTypes.ARRAY(DataTypes.STRING(7)),
      allowNull: true,
    },
    validFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    validTill: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    cronDescription: {
      type: DataTypes.VIRTUAL,
      get() {
        if (this.cron) {
          return describeCron(this.cron, this.frequency);
        } else {
          return null;
        }
      },
    },
  },
  {
    tableName: "preventative_maintenances",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);
PreventativeMaintenance.belongsTo(Administrator, {
  as: "createdBy",
  foreignKey: "adminId",
});

PreventativeMaintenance.belongsTo(Asset, {
  as: "asset",
  foreignKey: "typeId",
});

PreventativeMaintenance.belongsTo(Flat, {
  as: "flat",
  foreignKey: "typeId",
});

PreventativeMaintenance.belongsTo(Building, {
  as: "building",
  foreignKey: "typeId",
});

PreventativeMaintenance.hasMany(PreventativeSchedule, {
  foreignKey: "preventativeMaintenanceId",
  as: "preventativeSchedule",
});

// PreventativeMaintenance.sync({ force: true });
// PreventativeMaintenance.sync({ alter: true });

module.exports = PreventativeMaintenance;
