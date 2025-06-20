const express = require('express');
const router = express.Router();
const tenantRoutes = require('./tenant');

router.use('/tenants', tenantRoutes);

module.exports = router; 