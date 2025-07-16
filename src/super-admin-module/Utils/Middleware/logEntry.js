const Log = require('../../logs-service/models/log');

// Middleware to log CUD operations
async function logEntry(req, res, next) {
  // Only log after response is sent
  res.on('finish', async () => {
    // Only log for CUD methods
    
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
    // Determine action
    let action = req.logMeta?.action;
    if (!action) {
      if (req.method === 'POST') action = 'create';
      if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
      if (req.method === 'DELETE') action = 'delete';
    }
    // Entity and entity_id can be set via req.logMeta in controller, or fallback to route
    const entity = req.logMeta?.entity || req.baseUrl.split('/').pop();
    const entity_id = req.logMeta?.entity_id || req.params?.id || req.params?.tenant_id || req.params?.user_id || req.body?.id || req.body?.tenant_id || req.body?.user_id || null;
    // User info (customize as needed)
    const user_id = req.user?.id || null;
    const email = req.user?.email || req.body?.email || null;
    // Status and reason
    let status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';
    let reason = res.locals.logError || null;
    // Only log if we have enough info
    if (action && entity) {
      try {
        await Log.create({
          user_id,
          email,
          action,
          entity,
          entity_id,
          status,
          reason
        });
      } catch (e) {
        // Optionally log to console or ignore
      }
    }
  });
  next();
}

module.exports = logEntry; 