const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController.js');
const tenantUserController = require('../controllers/tenantUserController.js');
const tenantUsersPermissionController = require('../controllers/tenantUsersPermissionController.js');
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

// Tenant Category 
// Get All Tenants


router.get('/tenant/category', authenticateToken, tenantUserController.getAllCategory);
// Tenant User CRUD
router.post('/tenant-users', authenticateToken, tenantUserController.createTenantUser, logEntry);
router.get('/tenant-users/all', authenticateToken, tenantUserController.getAllTenantUsers);
router.get('/tenant-users/:user_id', authenticateToken, tenantUserController.getTenantUserById);
router.put('/tenant-users/:user_id', authenticateToken, logEntry, tenantUserController.updateTenantUser);
router.delete('/tenant-users/:user_id', authenticateToken, logEntry, tenantUserController.deleteTenantUser);

// Tenant Users Permission CRUD
router.post('/tenant-users-permission', authenticateToken, tenantUsersPermissionController.createPermission, logEntry);
// Permissions for a specific tenant
// GET all permissions for a tenant: /tenant-users-permission/all?tenant_id=...
router.get('/tenant-users-permission/all', authenticateToken, tenantUsersPermissionController.getAllPermissions);
// GET single permission for a tenant: /tenant-users-permission/:role_id?tenant_id=...
router.get('/tenant-users-permission/:role_id', authenticateToken, tenantUsersPermissionController.getPermissionById);
// PUT update permission for a tenant: tenant_id in body
router.put('/tenant-users-permission/:role_id', authenticateToken, logEntry, tenantUsersPermissionController.updatePermission);
// DELETE permission for a tenant: tenant_id in body
router.delete('/tenant-users-permission/:role_id', authenticateToken, logEntry, tenantUsersPermissionController.deletePermission);

// Tenant Login/Logout
router.post('/login', tenantController.tenantLogin);
router.post('/logout', tenantController.tenantLogout);

// Error handler (should be last)
router.use(errorHandler);

module.exports = router; 