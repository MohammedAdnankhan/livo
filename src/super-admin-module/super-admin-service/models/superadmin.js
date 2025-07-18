const { DataTypes } = require('sequelize');
const db = require("../../../database");

// const SuperAdmin = db.sequelize.define('SuperAdmin', {
const SuperAdmin = db.sequelize.define('super_admins', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  name: {
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
  token: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'super_admin_table',
  freezeTableName: true
});

module.exports = SuperAdmin;
