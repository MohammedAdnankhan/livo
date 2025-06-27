const { DataTypes } = require('sequelize');
const db = require('../../db.js');

const Page = db.sequelize.define('pages', 
  {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
}, {
  tableName: 'pages',
  timestamps: false,
  freezeTableName: true
});

module.exports = Page; 