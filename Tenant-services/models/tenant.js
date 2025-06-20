const { DataTypes } = require('sequelize');
const db = require('../../db');

const Tenant = db.sequelize.define('Tenant', {
  tenant_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  tenant_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  admin_user_email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  admin_user_password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contact_email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contact_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  industry: {
    type: DataTypes.STRING,
    allowNull: true
  },
  modules_enabled: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

module.exports = Tenant; 