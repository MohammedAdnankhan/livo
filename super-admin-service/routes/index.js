const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const authenticateToken = require('../../Utils/Middleware/auth');

router.post('/super-admin/create', superAdminController.createSuperAdmin);
router.post('/super-admin/login', superAdminController.loginSuperAdmin);
router.post('/super-admin/logout', authenticateToken, superAdminController.logoutSuperAdmin);
router.get('/super-admin/details', authenticateToken, superAdminController.getSuperAdminDetails);

module.exports = router;
