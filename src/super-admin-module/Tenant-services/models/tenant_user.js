const { DataTypes } = require('sequelize');
const db = require('../../../database');
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

// last one 
// TenantUser.belongsTo(TenantUsersPermission, { foreignKey: 'role_id', as: 'role' });


TenantUsersPermission.hasMany(TenantUser, {
  foreignKey: 'role_id', // User table has role_id pointing to TenantUsersPermission
  as: 'users', // Multiple users can have the same permission/role
});
 
// In User.js (or TenantUser.js)
TenantUser.belongsTo(TenantUsersPermission, {
  foreignKey: 'role_id', // User table has role_id column
  as: 'permission', // Each user belongs to one permission/role
  onDelete: 'SET NULL'
});
 


module.exports = TenantUser; 