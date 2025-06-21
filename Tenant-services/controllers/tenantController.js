const Tenant = require('../models/tenant.js');
const bcrypt = require('bcryptjs');

exports.createTenant = async (req, res, next) => {
  try {
    const { tenant_name, admin_user_email, admin_user_password, contact_email, contact_number, industry, modules_enabled, status, notes } = req.body;
    // Check if tenant with same email already exists
    let tenant = await Tenant.findOne({ where: { admin_user_email } });
    if (tenant) {
      return res.status(400).json({ message: 'Tenant already exists' });
    }
    const hashedPassword = await bcrypt.hash(admin_user_password, 10);
    tenant = await Tenant.create({
      tenant_name,
      admin_user_email,
      admin_user_password: hashedPassword,
      contact_email,
      contact_number,
      industry,
      modules_enabled,
      status,
      notes
    });
    return res.status(201).json({ message: 'Tenant created', tenant });
  } catch (err) {
    next(err);
  }
};

exports.getAllTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll();
    res.status(200).json({ tenants });
  } catch (err) {
    next(err);
  }
};

exports.getTenantById = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    const tenant = await Tenant.findByPk(tenant_id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    res.status(200).json({ tenant });
  } catch (err) {
    next(err);
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
      'modules_enabled',
      'status',
      'notes'
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
      return res.status(404).json({ message: 'Tenant not found' });
    }
    const tenant = await Tenant.findByPk(tenant_id);
    res.status(200).json({ message: 'Tenant updated', tenant });
  } catch (err) {
    next(err);
  }
};

exports.deleteTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    const deleted = await Tenant.destroy({ where: { tenant_id } });
    if (!deleted) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    res.status(200).json({ message: 'Tenant deleted' });
  } catch (err) {
    next(err);
  }
}; 