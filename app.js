const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db');
// const userRoutes = require('./routes/userRoutes');
require('dotenv').config();
const superAdminRoutes = require('./super-admin-service/routes');
const errorHandler = require('./Utils/Middleware/errorHandler');
const tenantRoutes = require('./Tenant-services/routes');

app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Enable CORS
app.use(helmet()); // Secure HTTP headers
// app.use('/api/users', userRoutes);
app.use('/api', superAdminRoutes);
app.use('/api', tenantRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

db.sequelize.sync({ alter: true });
