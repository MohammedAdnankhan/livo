const { DataTypes } = require('sequelize');
const db = require('../../db');

const SuperAdmin = db.sequelize.define('SuperAdmin', {
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
});

module.exports = SuperAdmin;
