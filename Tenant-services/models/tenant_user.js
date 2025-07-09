const { DataTypes } = require('sequelize');
const db = require('../../db.js');
const TenantUsersPermission = require('./tenant_users_permission');

const TenantUser = db.sequelize.define('tenant_user', {
  user_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    allowNull: false,
    defaultValue: 'Active'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'tenant_users',
  freezeTableName: true,
  timestamps: false
});

TenantUser.belongsTo(TenantUsersPermission, { foreignKey: 'role_id', as: 'role' });

module.exports = TenantUser; 