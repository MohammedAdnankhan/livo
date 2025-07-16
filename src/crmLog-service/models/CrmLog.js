const { DataTypes } = require("sequelize");
const db = require("../../database");

const CrmLog = db.sequelize.define(
  "CrmLog",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    response: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "crm_logs",
    paranoid: true,
  }
);

// CrmLog.sync({ force: true });
// CrmLog.sync({ alter: true });

module.exports = CrmLog;
