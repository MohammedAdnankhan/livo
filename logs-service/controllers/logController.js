const Log = require('../models/log');

// Create a new log
exports.createLog = async (req, res) => {
  try {
    const { user_id, email, action, entity, entity_id, status, reason } = req.body;
    if (!user_id || !email || !action || !entity || !entity_id || !status) {
      return res.status(400).json({ success: false, code: 400, message: 'Missing required fields' });
    }
    const log = await Log.create({ user_id, email, action, entity, entity_id, status, reason });
    return res.status(201).json({ success: true, code: 201, message: 'Log created', data: log });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error creating log', error: err.message });
  }
};

// Get all logs
exports.getAllLogs = async (req, res) => {
  try {
    const logs = await Log.findAll();
    return res.status(200).json({ success: true, code: 200, message: 'Logs fetched', data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching logs', error: err.message });
  }
};

// Get a log by id
exports.getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await Log.findByPk(id);
    if (!log) return res.status(404).json({ success: false, code: 404, message: 'Log not found' });
    return res.status(200).json({ success: true, code: 200, message: 'Log fetched', data: log });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching log', error: err.message });
  }
};

// Delete a log
exports.deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Log.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ success: false, code: 404, message: 'Log not found' });
    return res.status(200).json({ success: true, code: 200, message: 'Log deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error deleting log', error: err.message });
  }
}; 