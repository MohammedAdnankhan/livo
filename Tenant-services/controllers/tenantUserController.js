const TenantUser = require('../models/tenant_user');
const Tenant = require('../models/tenant');
const bcrypt = require('bcryptjs');
const Role = require('../../permission-service/models/roles');
const Page = require('../../permission-service/models/pages');
const Permission = require('../../permission-service/models/permissions');
const { Op } = require('sequelize');
const TenantUsersPermission = require('../models/tenant_users_permission');
const { tenantCategories } = require('../../Utils/constant');
// Create Tenant User
exports.createTenantUser = async (req, res, next) => {
  req.logMeta = { entity: 'TenantUser', entity_id: null, action: 'create' };
  try {
    const { tenant_id, full_name, email, role_id, status, password } = req.body;
    // Check user_add_limit for the tenant
    const tenant = await Tenant.findByPk(tenant_id);
    if (!tenant) {
      res.status(404).json({ success: false, code: 404, message: 'Tenant not found' });
      return next();
    }
    // 1. Check if email matches any admin_user_email in tenant table
    const adminEmailMatch = await Tenant.findOne({ where: { admin_user_email: email } });
    if (adminEmailMatch) {
      res.status(400).json({ success: false, code: 400, message: 'Email already used as tenant admin email' });
      return next();
    }
    // 2. Check if user with same email and tenant_id already exists
    const userEmailMatch = await TenantUser.findOne({ where: { tenant_id, email } });
    if (userEmailMatch) {
      res.status(400).json({ success: false, code: 400, message: 'User with this email already exists for this tenant' });
      return next();
    }
    if (!password) {
      res.status(400).json({ success: false, code: 400, message: 'Password is required' });
      return next();
    }
    const userCount = await TenantUser.count({ where: { tenant_id } });
    if (tenant.user_add_limit !== null && userCount >= tenant.user_add_limit) {
      res.status(400).json({ success: false, code: 400, message: 'User add limit reached for this tenant' });
      return next();
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await TenantUser.create({ tenant_id, full_name, email, role_id, status, password: hashedPassword });
    req.logMeta = { entity: 'TenantUser', entity_id: user.user_id, action: 'create' };
    res.status(201).json({ success: true, code: 201, message: 'Tenant user created', data: user });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

// Get All Tenant Users (optionally by tenant_id)
exports.getAllTenantUsers = async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    const where = tenant_id ? { tenant_id } : {};
    // const users = await TenantUser.findAll({
    //   where,
    //   order: [['created_at', 'DESC']]
    // });
    
    const users = await TenantUser.findAll({
      where,
      include: [{
        model: TenantUsersPermission,
        as: 'permission',
        attributes: ['role_id', 'role_name', 'modules', 'tenant_id']
      }],
      order: [['created_at', 'DESC']]
    });


    
    res.status(200).json({ success: true, code: 200, message: 'Tenant users fetched', data: users  ,});
    return next && next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next && next();
  }z
};
exports.getAllCategory = async (req, res, next) => {
  try {
    console.log("here try")
      return res.status(200).json({ success: true, code: 200, message: 'Tenants Category fetched', data: tenantCategories, } );
  } catch (err) {
    console.log("false try")

    return res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
  }
};

// Get Tenant User by ID
exports.getTenantUserById = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const user = await TenantUser.findByPk(user_id);
    if (!user) {
      res.status(404).json({ success: false, code: 404, message: 'Tenant user not found' });
      return next();
    }
    res.status(200).json({ success: true, code: 200, message: 'Tenant user fetched', data: user });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

// Update Tenant User
exports.updateTenantUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const allowedFields = ['full_name', 'email', 'role_id', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    const [updated] = await TenantUser.update(updateData, { where: { user_id } });
    if (!updated) {
      res.status(404).json({ success: false, code: 404, message: 'Tenant user not found' });
      return next();
    }
    const user = await TenantUser.findByPk(user_id);
    res.status(200).json({ success: true, code: 200, message: 'Tenant user updated', data: user });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

// Delete Tenant User
exports.deleteTenantUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const deleted = await TenantUser.destroy({ where: { user_id } });
    if (!deleted) {
      res.status(404).json({ success: false, code: 404, message: 'Tenant user not found' });
      return next();
    }
    res.status(200).json({ success: true, code: 200, message: 'Tenant user deleted successfully' });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
}; 