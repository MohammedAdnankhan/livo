const { DataTypes } = require('sequelize');
const db = require('../../db.js');
const Role = require('./roles');
const Page = require('./pages');

const Permission = db.sequelize.define('permissions', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Role,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  page_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Page,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  can_view: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  can_edit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  can_delete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  can_update: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'permissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['role_id', 'page_id'],
    },
  ],
});

Permission.belongsTo(Role, { foreignKey: 'role_id', onDelete: 'CASCADE' });
Permission.belongsTo(Page, { foreignKey: 'page_id', onDelete: 'CASCADE' });

module.exports = Permission; 