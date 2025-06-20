const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const authenticateToken = require('../../Utils/Middleware/auth');
const errorHandler = require('../../Utils/Middleware/errorHandler');

// Create Tenant
router.post('/', authenticateToken, tenantController.createTenant);
// Get All Tenants
router.get('/', authenticateToken, tenantController.getAllTenants);
// Get Tenant by ID
router.get('/:tenant_id', authenticateToken, tenantController.getTenantById);
// Update Tenant
router.put('/:tenant_id', authenticateToken, tenantController.updateTenant);
// Delete Tenant
router.delete('/:tenant_id', authenticateToken, tenantController.deleteTenant);

// Error handler (should be last)
router.use(errorHandler);

module.exports = router; 