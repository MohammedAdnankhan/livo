const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const databaseConfig = require('./config/database.json')[env];

let sequelize;

if (process.env.DATABASE_PUBLIC_URL) {
  // Use Railway's DATABASE_URL in production
  sequelize = new Sequelize(process.env.DATABASE_PUBLIC_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  });
} else {
  // Use local config for development
  sequelize = new Sequelize(databaseConfig);
}

sequelize
  .authenticate()
  .then(() => {
    console.log('✅ Database Connected');
  })
  .catch((err) => {
    console.error(`❌ Error connecting to database: ${JSON.stringify(err)}`);
  });

const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
