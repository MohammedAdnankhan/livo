const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const db = require('./db.js');
// const userRoutes = require('./routes/userRoutes');
const superAdminRoutes = require('./super-admin-service/routes/index.js');
const permissionRoutes = require('./permission-service/routes/index.js');
const errorHandler = require('./Utils/Middleware/errorHandler.js');
const tenantRoutes = require('./Tenant-services/routes/index.js');
const userRoutes = require('./user-services/routes/index.js');
const logRoutes = require('./logs-service/routes/index.js');

app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Enable CORS
app.use(helmet()); // Secure HTTP headers
// app.use('/api/users', userRoutes);
app.use('/api', superAdminRoutes);
app.use('/api', tenantRoutes);
app.use('/api/permission', permissionRoutes);
app.use('/api/user', userRoutes);
app.use('/api', logRoutes);
app.use(errorHandler);

// Sync database with error handling, then start server
const PORT = process.env.PORT || 5000;
db.sequelize.sync({ force: false, alter: false })
  .then(() => {
    console.log('✅ Database synced successfully');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Database sync error:', err.message);
    // Optionally, you can exit the process if sync fails:
    // process.exit(1);
  });
