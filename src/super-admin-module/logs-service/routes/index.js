const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const authenticateToken = require('../../Utils/Middleware/auth.js');
// Create log
router.post('/log', logController.createLog);
// Get all logs
router.get('/logs', authenticateToken, logController.getAllLogs);
// Get log by id
router.get('/logs/:id', authenticateToken, logController.getLogById);
// Delete log by id
router.delete('/logs/:id', logController.deleteLog);

module.exports = router; 