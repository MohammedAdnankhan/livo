const TenantUsersPermission = require('../models/tenant_users_permission');
const Tenant = require('../models/tenant');

// Create Permission
exports.createPermission = async (req, res, next) => {
  req.logMeta = { entity: 'TenantUsersPermission', entity_id: null, action: 'create' };
  try {
    const { role_name, tenant_id, modules } = req.body;
    // Check if tenant exists
    const tenant = await Tenant.findByPk(tenant_id);
    if (!tenant) {
      res.status(404).json({ success: false, code: 404, message: 'Tenant not found' });
      return next();
    }
    // Only allow modules that are enabled for the tenant
    const enabledModules = tenant.modules || {};
    const filteredModules = {};
    for (const key of Object.keys(modules)) {
      if (enabledModules[key] && enabledModules[key].can_view) {
        filteredModules[key] = modules[key];
      }
    }
    const permission = await TenantUsersPermission.create({ role_name, tenant_id, modules: filteredModules });
    req.logMeta = { entity: 'TenantUsersPermission', entity_id: permission.role_id, action: 'create' };
    res.status(201).json({ success: true, code: 201, message: 'Permission created', data: permission });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

// Get All Permissions (by tenant_id)
exports.getAllPermissions = async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, code: 400, message: 'tenant_id is required' });
    }
    const permissions = await TenantUsersPermission.findAll({ where: { tenant_id }, order: [['role_name', 'ASC']] });
    res.status(200).json({ success: true, code: 200, message: 'Permissions fetched', data: permissions });
    return next && next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next && next();
  }
};

// Get Permission by ID (with tenant_id check)
exports.getPermissionById = async (req, res, next) => {
  try {
    const { role_id } = req.params;
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, code: 400, message: 'tenant_id is required' });
    }
    const permission = await TenantUsersPermission.findOne({ where: { role_id, tenant_id } });
    if (!permission) {
      return res.status(404).json({ success: false, code: 404, message: 'Permission not found for this tenant' });
    }
    res.status(200).json({ success: true, code: 200, message: 'Permission fetched', data: permission });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

// Update Permission (with tenant_id check)
exports.updatePermission = async (req, res, next) => {
  try {
    const { role_id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) {
      return res.status(400).json({ success: false, code: 400, message: 'tenant_id is required' });
    }
    // Only update if permission belongs to tenant
    const permission = await TenantUsersPermission.findOne({ where: { role_id, tenant_id } });
    if (!permission) {
      return res.status(404).json({ success: false, code: 404, message: 'Permission not found for this tenant' });
    }
    const allowedFields = ['role_name', 'modules'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    await TenantUsersPermission.update(updateData, { where: { role_id, tenant_id } });
    const updatedPermission = await TenantUsersPermission.findOne({ where: { role_id, tenant_id } });
    res.status(200).json({ success: true, code: 200, message: 'Permission updated', data: updatedPermission });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

// Delete Permission (with tenant_id check)
exports.deletePermission = async (req, res, next) => {
  try {
    const { role_id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) {
      return res.status(400).json({ success: false, code: 400, message: 'tenant_id is required' });
    }
    const deleted = await TenantUsersPermission.destroy({ where: { role_id, tenant_id } });
    if (!deleted) {
      return res.status(404).json({ success: false, code: 404, message: 'Permission not found for this tenant' });
    }
    res.status(200).json({ success: true, code: 200, message: 'Permission deleted successfully' });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
}; 