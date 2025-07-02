const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// Create log
router.post('/log', logController.createLog);
// Get all logs
router.get('/logs', logController.getAllLogs);
// Get log by id
router.get('/log/:id', logController.getLogById);
// Delete log by id
router.delete('/log/:id', logController.deleteLog);

module.exports = router; 