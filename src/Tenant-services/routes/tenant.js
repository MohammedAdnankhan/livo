const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController.js');
const authenticateToken = require('../../Utils/Middleware/auth.js');
const errorHandler = require('../../Utils/Middleware/errorHandler.js');
const logEntry = require('../../Utils/Middleware/logEntry');

// Create Tenant
router.post('/', authenticateToken, tenantController.createTenant, logEntry,);
// Get All Tenants
router.get('/', authenticateToken, tenantController.getAllTenants);
// Get Tenant by ID
router.get('/all/tenant/overview', authenticateToken, tenantController.getTenantOverview);
router.get('/:tenant_id', authenticateToken, tenantController.getTenantById);
// Update Tenant
router.put('/:tenant_id', authenticateToken, logEntry, tenantController.updateTenant);
// Delete Tenant
router.delete('/:tenant_id', authenticateToken, logEntry, tenantController.deleteTenant);
// Tenant Overview

// Error handler (should be last)
router.use(errorHandler);

module.exports = router; 