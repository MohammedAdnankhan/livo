const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db.js');
// const userRoutes = require('./routes/userRoutes');
require('dotenv').config();
const superAdminRoutes = require('./super-admin-service/routes/index.js');
const errorHandler = require('./Utils/Middleware/errorHandler.js');
const tenantRoutes = require('./Tenant-services/routes/index.js');

app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Enable CORS
app.use(helmet()); // Secure HTTP headers
// app.use('/api/users', userRoutes);
app.use('/api', superAdminRoutes);
app.use('/api', tenantRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Sync database with error handling
db.sequelize.sync({ force: false, alter: false })
  .then(() => {
    console.log('✅ Database synced successfully');
  })
  .catch((err) => {
    console.error('❌ Database sync error:', err.message);
    // Don't crash the app, just log the error
  });
