const Tenant = require('../models/tenant.js');
const bcrypt = require('bcryptjs');
const sendMail = require('../../Utils/sendMail');
const Log = require('../../logs-service/models/log');
const Administrator = require('../models/Admin');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'supersecret';
const TenantUser = require('../models/tenant_user.js'); // Added TenantUser import


exports.createTenant = async (req, res, next) => {
  req.logMeta = { entity: 'Tenant', entity_id: null, action: 'create' };
  try {
    const { tenant_name, admin_user_email, admin_user_password, contact_email, contact_number, industry, modules, status, notes, user_add_limit } = req.body;
    // Check if tenant with same email already exists
    let tenant = await Tenant.findOne({ where: { admin_user_email } });
    if (tenant) {
      res.status(400).json({ success: false, code: 400, message: 'Tenant already exists' });
      return next();
    }
    const hashedPassword = await bcrypt.hash(admin_user_password, 10);
    tenant = await Tenant.create({
      tenant_name,
      admin_user_email,
      admin_user_password: hashedPassword,
      contact_email,
      contact_number,
      industry,
      modules,
      status,
      notes,
      user_add_limit
    });
    await tenant.save();

    // Create the Administrator for this tenant
    await Administrator.create({
      name: tenant_name,
      email: admin_user_email,
      countryCode: '+1', // Default country code
      mobileNumber: contact_number || '9999', // fallback to a valid dummy number
      profilePicture: '',
      role: 'Admin',
      password: hashedPassword,
      propertyId: null // or set if you have a propertyId
    });

    // Send welcome email to admin
    const subject = 'Welcome to Our Platform!';
    const html = `
      <h2>Welcome, ${tenant_name} Admin!</h2>
      <p>Your tenant account has been created. Here are your login details:</p>
      <ul>
        <li><strong>Email:</strong> ${admin_user_email}</li>
        <li><strong>Password:</strong> ${admin_user_password}</li>
      </ul>
      <p>Please log in and change your password after your first login.</p>
      <br>
      <p>Best regards,<br>Your App Team</p>
    `;
    await sendMail({ to: contact_email, subject, html });

    req.logMeta = { entity: 'Tenant', entity_id: tenant.tenant_id, action: 'create' };
    res.status(201).json({ success: true, code: 201, message: 'Tenant created', data: tenant });
    return next();
  } catch (err) {
    req.logMeta = { entity: 'Tenant', entity_id: null, action: 'create' };
    res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
    return next();
  }
};

exports.getAllTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll({ order: [['createdAt', 'DESC']] });
    return res.status(200).json({ success: true, code: 200, message: 'Tenants fetched', data: tenants });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
  }
};

exports.getTenantById = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    const tenant = await Tenant.findByPk(tenant_id);
    if (!tenant) {
      return res.status(404).json({ success: false, code: 404, message: 'Tenant not found' });
    }
    return res.status(200).json({ success: true, code: 200, message: 'Tenant fetched', data: tenant });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
  }
};

exports.updateTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    // Only allow updatable fields
    const allowedFields = [
      'tenant_name',
      'admin_user_email',
      'admin_user_password',
      'contact_email',
      'contact_number',
      'industry',
      'modules',
      'status',
      'notes',
      'user_add_limit'
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    if (updateData.admin_user_password) {
      updateData.admin_user_password = await bcrypt.hash(updateData.admin_user_password, 10);
    }
    const [updated] = await Tenant.update(updateData, { where: { tenant_id } });
    if (!updated) {
      return res.status(404).json({ success: false, code: 404, message: 'Tenant not found' });
    }
    const tenant = await Tenant.findByPk(tenant_id);
    return res.status(200).json({ success: true, code: 200, message: 'Tenant updated', data: tenant });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
  }
};

exports.deleteTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    const deleted = await Tenant.destroy({ where: { tenant_id } });
    if (!deleted) {
      return res.status(404).json({ success: false, code: 404, message: 'Tenant not found' });
    }
    return res.status(200).json({ success: true, code: 200, message: 'Tenant deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
  }
};

exports.getTenantOverview = async (req, res) => {
  try {
    const totalTenants = await Tenant.count();
    const activeTenants = await Tenant.count({ where: { status: 'Active' } });
    const inactiveTenants = await Tenant.count({ where: { status: 'Inactive' } });
    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Tenant overview fetched',
      data: {
        totalTenants,
        activeTenants,
        inactiveTenants
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching tenant overview', error: err.message });
  }
};

exports.tenantLogin = async (req, res, next) => {
  try {
    const { email, password,  } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, code: 400, message: 'Email and password are required' });
    }
    // 1. Try to find in tenant table first
    let tenant = await Tenant.findOne({ where: { admin_user_email: email } });
    if (tenant) {
      // Compare password with tenant.admin_user_password
      const isMatch = await bcrypt.compare(password, tenant.admin_user_password);
      if (!isMatch) {
        return res.status(401).json({ success: false, code: 401, message: 'Invalid credentials' });
      }
      // sidebarData: keys of modules with can_view true
      const modules = tenant.modules || {};
      const sidebarData = Object.keys(modules).filter(key => modules[key] && modules[key].can_view);
      // Generate JWT access token
      const accessToken = jwt.sign({ email, type: 'admin', tenant_id: tenant.tenant_id }, SECRET, { expiresIn: '1h' });
      const refreshToken = '';
      const a_t = 'admin';
      return res.status(200).json({ accessToken, refreshToken, a_t, sidebarData,tenant,success: true, code:200});
    }
    // 2. If not found in tenant, check TenantUser table for user login
    const user = await TenantUser.findOne({ where: { email }, attributes: { include: ['password'] } });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, code: 401, message: 'Invalid credentials' });
      }
      // No sidebarData logic, just return a_t: 'tenant_user'
      const accessToken = jwt.sign({ id: user.user_id, email: user.email, type: 'tenant_user', tenant_id: user.tenant_id }, SECRET, { expiresIn: '1h' });
      const refreshToken = '';
      const a_t = 'tenant_user';
      return res.status(200).json({ accessToken, refreshToken, a_t ,user , success: true, code:200});
    }
    return res.status(401).json({ success: false, code: 401, message: 'Invalid credentials' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Internal server error', error: err.message });
  }
};

exports.tenantLogout = async (req, res, next) => {
  // JWT is stateless; just respond success
  return res.status(200).json({ success: true, code: 200, message: 'Logged out' });
}; 