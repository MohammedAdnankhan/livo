const { DataTypes } = require('sequelize');
const db = require('../../db.js');

const TenantUsersPermission = db.sequelize.define('tenant_users_permission', {
  role_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  role_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  modules: {
    type: DataTypes.JSONB,
    allowNull: false
  }
}, {
  tableName: 'tenant_users_permission',
  freezeTableName: true,
  timestamps: false
});

module.exports = TenantUsersPermission; 