const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../../Utils/Middleware/auth.js');

// User CRUD (all protected)
router.post('/', authenticateToken, userController.createUser);
router.get('/', authenticateToken, userController.getAllUsers);
router.get('/:id', authenticateToken, userController.getUserById);
router.put('/:id', authenticateToken, userController.updateUser);
router.delete('/:id', authenticateToken, userController.deleteUser);

// User Overview
router.get('/all/users/overview', authenticateToken, userController.getUsersOverview);

module.exports = router; 