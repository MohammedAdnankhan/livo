const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authenticateToken = require('../../Utils/Middleware/auth.js');
const logEntry = require('../../Utils/Middleware/logEntry.js');

// Role and Permission CRUD (protected)
router.post('/role/upsert', authenticateToken, roleController.createRoleWithPermissions,logEntry);
router.get('/roles', authenticateToken, roleController.getAllRolesWithPermissions);
router.get('/role/permissions', authenticateToken, roleController.getPermissionsForRole);
router.put('/role/permissions', authenticateToken, logEntry,roleController.updatePermissionsForRole);
router.delete('/role', authenticateToken, logEntry,roleController.deleteRole);

// Page CRUD (protected)
router.post('/page', authenticateToken, roleController.createPage);
router.get('/pages', authenticateToken, roleController.listPages);
router.put('/page/:id', authenticateToken, roleController.updatePage);
router.delete('/page/:id', authenticateToken, roleController.deletePage);

// Update role name (protected)
// router.put('/role/:id', authenticateToken, roleController.updateRoleName);

module.exports = router; 