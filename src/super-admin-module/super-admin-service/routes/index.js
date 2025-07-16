const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController.js');
const authenticateToken = require('../../Utils/Middleware/auth.js');
const logEntry = require('../../Utils/Middleware/logEntry');

router.post('/create', superAdminController.createSuperAdmin, logEntry);
    router.post('/super-admin/login', superAdminController.loginSuperAdmin, );
    router.post('/super-admin/logout', authenticateToken,logEntry ,superAdminController.logoutSuperAdmin);
    router.get('/super-admin/details', authenticateToken, superAdminController.getSuperAdminDetails);

module.exports = router;
