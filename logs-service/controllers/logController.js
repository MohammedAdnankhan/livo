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
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, code: 401, message: 'Unauthorized' });
    }
    if (user.author === 'superAdmin') {
      // Super admin: get all logs
      const logs = await Log.findAll();
      return res.status(200).json({ success: true, code: 200, message: 'All logs fetched', data: logs });
    } else if (user.author === 'user') {
      // User: get only their logs (by user_id)
      const logs = await Log.findAll({
        where: {
          user_id: user.id
        }
      });
      return res.status(200).json({ success: true, code: 200, message: 'User logs fetched', data: logs });
    } else {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching logs', error: err.message });
  }
};

// Get a log by id
exports.getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, code: 401, message: 'Unauthorized' });
    }
    if (user.author === 'superAdmin') {
      // Super admin: get all logs or by id
      if (id === 'all') {
        const logs = await Log.findAll();
        return res.status(200).json({ success: true, code: 200, message: 'All logs fetched', data: logs });
      } else {
        const log = await Log.findByPk(id);
        if (!log) return res.status(404).json({ success: false, code: 404, message: 'Log not found' });
        return res.status(200).json({ success: true, code: 200, message: 'Log fetched', data: log });
      }
    } else if (user.author === 'user') {
      // User: get only their logs (by user_id or role_id)
      const logs = await Log.findAll({
        where: {
          user_id: user.id
        }
      });
      // If you want to filter by role_id, you need to store role_id in logs or join with user table
      // If id !== 'all', filter for a specific log id
      if (id !== 'all') {
        const log = logs.find(l => l.id === id);
        if (!log) return res.status(404).json({ success: false, code: 404, message: 'Log not found or not authorized' });
        return res.status(200).json({ success: true, code: 200, message: 'Log fetched', data: log });
      }
      return res.status(200).json({ success: true, code: 200, message: 'User logs fetched', data: logs });
    } else {
      return res.status(403).json({ success: false, code: 403, message: 'Forbidden' });
    }
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