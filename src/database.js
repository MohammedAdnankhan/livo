const Sequelize = require("sequelize");
const logger = require("./utils/logger");
const env = process.env.NODE_ENV || "development";
const databaseConfig = require("./config/database.json")[env];

const sequelize = new Sequelize(databaseConfig);
sequelize
  .authenticate()
  .then(() => {
    logger.info("Database Connected");
  })
  .catch((err) => {
    logger.error(`Error connecting to database: ${JSON.stringify(err)}`);
  });

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
