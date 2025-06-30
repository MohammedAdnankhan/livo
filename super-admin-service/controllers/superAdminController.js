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
      return res.status(400).json({ message: 'SuperAdmin already exists' });
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
    return res.status(201).json({ message: 'SuperAdmin created', superAdmin });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating SuperAdmin', error: err.message });
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
        const err = new Error('Invalid Username or Password');
        err.statusCode = 401;
        return next(err);
      }
      const token = jwt.sign(
        { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email,author:"superAdmin" },
        SECRET,
        { expiresIn: '1d' }
      );
      superAdmin.token = token;
      await superAdmin.save();
      return res.status(200).json({ message: 'Login successful', token ,author:"superAdmin"});
    }
    // Try User next
    let user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        const err = new Error('Invalid Username or Password');
        err.statusCode = 401;
        return next(err);
      }
      const token = jwt.sign(
        { id: user.user_id, name: user.full_name, email: user.email, author: 'user' , },
        SECRET,
        { expiresIn: '1d' }
      );
      user.token = token;
      await user.save();
      return res.status(200).json({
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
    const err = new Error('Invalid Username or Password');
    err.statusCode = 401;
    return next(err);
  } catch (err) {
    next(err);
  }
};

exports.logoutSuperAdmin = async (req, res, next) => {
  try {
    const { id } = req.user;
    const superAdmin = await SuperAdmin.findByPk(id);
    if (!superAdmin) {
      const err = new Error('SuperAdmin not found');
      err.statusCode = 404;
      return next(err);
    }
    superAdmin.token = null;
    await superAdmin.save();
    res.status(200).json({ message: 'Logout successful' });
  } catch (err) {
    next(err);
  }
};

exports.getSuperAdminDetails = async (req, res, next) => {
  try {
    const { id } = req.user;
    const superAdmin = await SuperAdmin.findByPk(id, {
      attributes: ['id', 'name', 'email']
    });
    if (!superAdmin) {
      const err = new Error('SuperAdmin not found');
      err.statusCode = 404;
      return next(err);
    }
    res.status(200).json({ superAdmin });
  } catch (err) {
    next(err);
  }
}; 