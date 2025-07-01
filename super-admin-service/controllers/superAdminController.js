const SuperAdmin = require('../models/superadmin.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../user-services/models/user');
const Role = require('../../permission-service/models/roles');

const SECRET = process.env.JWT_SECRET || 'supersecret';

exports.createSuperAdmin = async (req, res) => {
  try {
    // Check if SuperAdmin already exists
    let superAdmin = await SuperAdmin.findOne({ where: { email: 'superadmin@yopmail.com' } });
    if (superAdmin) {
      return res.status(400).json({ success: false, code: 400, message: 'SuperAdmin already exists' });
    }
    const hashedPassword = await bcrypt.hash('Test@1234', 10);
    const token = jwt.sign({ email: 'superadmin@yopmail.com' }, SECRET, { expiresIn: '1d' });
    superAdmin = await SuperAdmin.create({
      name: 'Super-Admin',
      email: 'superadmin@yopmail.com',
      password: hashedPassword,
      token: null
    });
    await superAdmin.save()
    return res.status(201).json({ success: true, code: 201, message: 'SuperAdmin created', data: superAdmin });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error creating SuperAdmin', error: err.message });
  }
};

exports.loginSuperAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // Try SuperAdmin first
    let superAdmin = await SuperAdmin.findOne({ where: { email } });
    if (superAdmin) {
      const isMatch = await bcrypt.compare(password, superAdmin.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, code: 401, message: 'Invalid Username or Password' });
      }
      const token = jwt.sign(
        { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email, author: 'superAdmin' },
        SECRET,
        { expiresIn: '1d' }
      );
      superAdmin.token = token;
      await superAdmin.save();
      return res.status(200).json({ success: true, code: 200, message: 'Login successful', token, author: 'superAdmin' });
    }
    // Try User next
    let user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, code: 401, message: 'Invalid Username or Password' });
      }
      const token = jwt.sign(
        { id: user.user_id, name: user.full_name, email: user.email, author: 'user' },
        SECRET,
        { expiresIn: '1d' }
      );
      user.token = token;
      await user.save();
      return res.status(200).json({
        success: true,
        code: 200,
        message: 'Login successful',
        token,
        user: {
          id: user.user_id,
          name: user.full_name,
          email: user.email,
          status: user.status,
          author: 'User',
          roleId: user.role_id || null,
          roleName: user.role ? user.role.name : null
        }
      });
    }
    // If neither found
    return res.status(401).json({ success: false, code: 401, message: 'Invalid Username or Password' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error logging in', error: err.message });
  }
};

exports.logoutSuperAdmin = async (req, res, next) => {
  try {
    const { id } = req.user;
    const superAdmin = await SuperAdmin.findByPk(id);
    if (!superAdmin) {
      return res.status(404).json({ success: false, code: 404, message: 'SuperAdmin not found' });
    }
    superAdmin.token = null;
    await superAdmin.save();
    return res.status(200).json({ success: true, code: 200, message: 'Logout successful' });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error logging out', error: err.message });
  }
};

exports.getSuperAdminDetails = async (req, res, next) => {
  try {
    const { id } = req.user;
    const superAdmin = await SuperAdmin.findByPk(id, {
      attributes: ['id', 'name', 'email']
    });
    if (!superAdmin) {
      return res.status(404).json({ success: false, code: 404, message: 'SuperAdmin not found' });
    }
    return res.status(200).json({ success: true, code: 200, message: 'SuperAdmin details fetched', data: superAdmin });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching SuperAdmin details', error: err.message });
  }
}; 