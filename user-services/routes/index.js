const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../../Utils/Middleware/auth.js');
const logEntry = require('../../Utils/Middleware/logEntry');

// User CRUD (all protected)
router.get('/', authenticateToken, userController.getAllUsers);
router.get('/:id', authenticateToken, userController.getUserById);
router.post('/', authenticateToken, userController.createUser, logEntry);
router.put('/:id', authenticateToken, logEntry, userController.updateUser);
router.delete('/:id', authenticateToken, logEntry, userController.deleteUser);

// User Overview
router.get('/all/users/overview', authenticateToken, userController.getUsersOverview);

module.exports = router; 