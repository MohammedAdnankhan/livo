const Role = require('../models/roles');
const Page = require('../models/pages');
const Permission = require('../models/permissions');
const { Op } = require('sequelize');

// 1. Create/Update Role with Permissions
exports.createRoleWithPermissions = async (req, res, next) => {
  req.logMeta = { entity: 'Role', entity_id: null, action: 'create' };
  try {
    const { role_name, permissions } = req.body; // permissions: [{ page_id, can_view, can_edit, can_delete, can_update }]
    if (!role_name || !Array.isArray(permissions)) {
      res.status(400).json({ success: false, code: 400, message: 'role_name and permissions array are required' });
      return next();
    }
    let role = await Role.findOne({ where: { name: role_name.trim().toLowerCase() } });
    if (!role) {
      role = await Role.create({ name: role_name });
      await role.save();
    }
    // Upsert permissions
    for (const perm of permissions) {
      await Permission.upsert({
        role_id: role.id,
        page_id: perm.page_id,
        can_view: !!perm.can_view,
        can_edit: !!perm.can_edit,
        can_delete: !!perm.can_delete,
        can_update: !!perm.can_update,
      });
    }
    req.logMeta = { entity: 'Role', entity_id: role.id, action: 'create' };
    res.status(200).json({ success: true, code: 200, message: 'Role and permissions upserted', data: { role_id: role.id } });
    return next();
  } catch (err) {
    req.logMeta = { entity: 'Role', entity_id: null, action: 'create' };
    res.status(500).json({ success: false, code: 500, message: 'Error upserting role/permissions', error: err.message });
    return next();
  }
};

// 2. Get All Roles with Their Permissions
exports.getAllRolesWithPermissions = async (req, res) => {
  try {
    const roles = await Role.findAll({
      include: [{
        model: Permission,
        include: [{ model: Page, attributes: ['id', 'name'] }],
      }],
      order: [['id', 'ASC']],
    });
    return res.status(200).json({ success: true, code: 200, message: 'Roles fetched', data: roles });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching roles', error: err.message });
  }
};

// 3. Get Permissions for a Single Role
exports.getPermissionsForRole = async (req, res) => {
  try {
    const { role_id, role_name } = req.query;
    let where = {};
    if (role_id) where.id = role_id;
    if (role_name) where.name = role_name.trim().toLowerCase();
    const role = await Role.findOne({
      where,
      include: [{
        model: Permission,
        include: [{ model: Page, attributes: ['id', 'name'] }],
      }],
    });
    if (!role) return res.status(404).json({ success: false, code: 404, message: 'Role not found' });
    return res.status(200).json({ success: true, code: 200, message: 'Role permissions fetched', data: role });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching role permissions', error: err.message });
  }
};

// 4. Update Permissions for a Role
exports.updatePermissionsForRole = async (req, res) => {
  try {
    const { role_id, permissions,role_name } = req.body; // permissions: [{ page_id, can_view, can_edit, can_delete, can_update }]
    if (!role_id || !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, code: 400, message: 'role_id and permissions array are required' });
    }
    for (const perm of permissions) {
      await Permission.update({
        can_view: !!perm.can_view,
        can_edit: !!perm.can_edit,
        can_delete: !!perm.can_delete,
        can_update: !!perm.can_update,
      }, {
        where: { role_id, page_id: perm.page_id  },
      });
    }


    return res.status(200).json({ success: true, code: 200, message: 'Permissions updated' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error updating permissions', error: err.message });
  }
};

// 5. Delete a Role (with cascade delete of its permissions)
exports.deleteRole = async (req, res) => {
  try {
    const { role_id } = req.body;
    if (!role_id) return res.status(400).json({ success: false, code: 400, message: 'role_id is required' });
    const deleted = await Role.destroy({ where: { id: role_id } });
    if (!deleted) return res.status(404).json({ success: false, code: 404, message: 'Role not found' });
    return res.status(200).json({ success: true, code: 200, message: 'Role deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error deleting role', error: err.message });
  }
};

// 6. Optional: Add or list pages
exports.createPage = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, code: 400, message: 'Page name is required' });
    const page = await Page.create({ name });
    await page.save();
    return res.status(201).json({ success: true, code: 201, message: 'Page created', data: page });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error creating page', error: err.message });
  }
};

exports.listPages = async (req, res) => {
  try {
    const pages = await Page.findAll();
    return res.status(200).json({ success: true, code: 200, message: 'Pages fetched', data: pages });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching pages', error: err.message });
  }
};

// Update a page
exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, code: 400, message: 'Page name is required' });
    const [updated] = await Page.update({ name }, { where: { id } });
    if (!updated) return res.status(404).json({ success: false, code: 404, message: 'Page not found' });
    const page = await Page.findByPk(id);
    return res.status(200).json({ success: true, code: 200, message: 'Page updated', data: page });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error updating page', error: err.message });
  }
};

// Delete a page
exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Page.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ success: false, code: 404, message: 'Page not found' });
    return res.status(200).json({ success: true, code: 200, message: 'Page deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error deleting page', error: err.message });
  }
};

// Setup associations for eager loading
Role.hasMany(Permission, { foreignKey: 'role_id', onDelete: 'CASCADE' });
Permission.belongsTo(Role, { foreignKey: 'role_id', onDelete: 'CASCADE' });
Permission.belongsTo(Page, { foreignKey: 'page_id', onDelete: 'CASCADE' }); 