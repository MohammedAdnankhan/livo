const { DataTypes } = require("sequelize");
const db = require("../../../database");
const Administrator = require("../../../admin-service/models/Admin");
// We'll define the relationship after both models are loaded to avoid circular dependencies

// const Tenant = db.sequelize.define('Tenant', {
const Tenant = db.sequelize.define(
  "tenant",
  {
    tenant_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    tenant_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    admin_user_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    admin_user_password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contact_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contact_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    modules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    user_add_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    connected_admin_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "tenant_table",
    freezeTableName: true,
  }
);

Tenant.belongsTo(Administrator, {
  foreignKey: "connected_admin_id",
  as: "administrator",
});

// Tenant.sync({ alter: true });

module.exports = Tenant;
