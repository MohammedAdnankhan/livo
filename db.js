const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const databaseConfig = require('./config/database.json')[env];

const sequelize = new Sequelize(databaseConfig);

sequelize
  .authenticate()
  .then(() => {
    console.log('Database Connected');
  })
  .catch((err) => {
    console.error(`Error connecting to database: ${JSON.stringify(err)}`);
  });

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.sequelize.sync({ alter: true });

module.exports = db;
