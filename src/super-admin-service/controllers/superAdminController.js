const SuperAdmin = require('../models/superadmin.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../user-services/models/user');
const Role = require('../../permission-service/models/roles');
const Log = require('../../logs-service/models/log');

const SECRET = process.env.JWT_SECRET || 'supersecret';

exports.createSuperAdmin = async (req, res, next) => {
  try {
    // Check if SuperAdmin already exists
    let superAdmin = await SuperAdmin.findOne({ where: { email: 'superadmin@yopmail.com' } });
    if (superAdmin) {
      res.status(400).json({ success: false, code: 400, message: 'SuperAdmin already exists' });
      return next();
    }
    const hashedPassword = await bcrypt.hash('Test@1234', 10);
    const token = jwt.sign({ email: 'superadmin@yopmail.com' }, SECRET, { expiresIn: '1d' });
    superAdmin = await SuperAdmin.create({
      name: 'Super-Admin',
      email: 'superadmin@yopmail.com',
      password: hashedPassword,
      token: null
    });
    await superAdmin.save();
    res.status(201).json({ success: true, code: 201, message: 'SuperAdmin created', data: superAdmin });
    return next();
  } catch (err) {
    res.status(500).json({ success: false, code: 500, message: 'Error creating SuperAdmin', error: err.message });
    return next();
  }
};

exports.loginSuperAdmin = async (req, res, next) => {
  req.logMeta = { entity: 'SuperAdmin', entity_id: null, action: 'login' };

  try {
    const { email, password } = req.body;
    // Try SuperAdmin first
    let superAdmin = await SuperAdmin.findOne({ where: { email } });
    if (superAdmin) {
      const isMatch = await bcrypt.compare(password, superAdmin.password);
      if (!isMatch) {
        await Log.create({
          user_id: superAdmin.id,
          email: superAdmin.email,
          action: 'login',
          entity: 'SuperAdmin',
          entity_id: superAdmin.id,
          status: 'failure',
          reason: 'Invalid password'
        });
        req.logMeta = { entity: 'SuperAdmin', entity_id: superAdmin.id, action: 'login' };
        res.status(401).json({ success: false, code: 401, message: 'Invalid Username or Password' });
        return next();
      }
      const token = jwt.sign(
        { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email, author: 'superAdmin' },
        SECRET,
        { expiresIn: '1d' }
      );
      superAdmin.token = token;
      await superAdmin.save();
      await Log.create({
        user_id: superAdmin.id,
        email: superAdmin.email,
        action: 'login',
        entity: 'SuperAdmin',
        entity_id: superAdmin.id,
        status: 'success',
        reason: null
      });
      req.logMeta = { entity: 'SuperAdmin', entity_id: superAdmin.id, action: 'login' ,email: superAdmin.email, };
      res.status(200).json({ success: true, code: 200, message: 'Login successful', token, author: 'superAdmin' });
      return next();
    }
    // Try User next
    let user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        req.logMeta = { entity: 'User', entity_id: user.user_id, action: 'login' };
        res.status(401).json({ success: false, code: 401, message: 'Invalid Username or Password' });
        await Log.create({
          user_id: user.user_id,
          email: email,
          action: 'login',
          entity: 'User',
          entity_id: "",
          status: 'failure',
          reason: null
        });
        return next();
      }
      const token = jwt.sign(
        { id: user.user_id, name: user.full_name, email: user.email, author: 'user' },
        SECRET,
        { expiresIn: '1d' }
      );
      user.token = token;
      await user.save();
      // req.logMeta = { entity: 'User', entity_id: user.user_id, action: 'login' };
      await Log.create({
        user_id: user.user_id,
        email: email,
        action: 'login',
        entity: 'User',
        entity_id: "",
        status: 'success',
        reason: null
      });
      res.status(200).json({
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
      return next();
    }
    // If neither found
    req.logMeta = { entity: 'Unknown', entity_id: null ,action: 'login'};
    res.status(401).json({ success: false, code: 401, message: 'Invalid Username or Password' });
    return next();
  } catch (err) {
    req.logMeta = { entity: 'Unknown', entity_id: null  ,action: 'login'};
    res.status(500).json({ success: false, code: 500, message: 'Error logging in', error: err.message });
    return next();
  }
};

exports.logoutSuperAdmin = async (req, res, next) => {
  try {
    const { id, author } = req.user;
    if (author === 'superAdmin') {
      const superAdmin = await SuperAdmin.findByPk(id);
      if (!superAdmin) {
        req.logMeta = { entity: 'SuperAdmin', entity_id: id,action: 'logout' };
        res.status(404).json({ success: false, code: 404, message: 'SuperAdmin not found' });
        return next();
      }
      superAdmin.token = null;
      await superAdmin.save();
      req.logMeta = { entity: 'SuperAdmin', entity_id: id ,action: 'logout'};
      res.status(200).json({ success: true, code: 200, message: 'Logout successful' });
      return next();
    } else if (author === 'user') {
      const user = await User.findByPk(id);
      if (!user) {
        req.logMeta = { entity: 'User', entity_id: id ,action: 'logout'};
        res.status(404).json({ success: false, code: 404, message: 'User not found' });
        return next();
      }
      user.token = null;
      await user.save();
      req.logMeta = { entity: 'User', entity_id: id,action: 'logout' };
      res.status(200).json({ success: true, code: 200, message: 'Logout successful' });
      return next();
    } else {
      req.logMeta = { entity: 'Unknown', entity_id: id,action: 'logout' };
      res.status(400).json({ success: false, code: 400, message: 'Invalid user type' });
      return next();
    }
  } catch (err) {
    req.logMeta = { entity: 'Unknown', entity_id: null ,action: 'logout'};
    res.status(500).json({ success: false, code: 500, message: 'Error logging out', error: err.message });
    return next();
  }
};

exports.getSuperAdminDetails = async (req, res, next) => {
  try {
    const { id, author } = req.user;
    if (author === 'superAdmin') {
      const superAdmin = await SuperAdmin.findByPk(id, {
        attributes: ['id', 'name', 'email']
      });
      if (!superAdmin) {
        return res.status(404).json({ success: false, code: 404, message: 'SuperAdmin not found' });
      }
      return res.status(200).json({ success: true, code: 200, message: 'SuperAdmin details fetched', data: superAdmin });
    } else if (author === 'user') {
      const user = await User.findByPk(id, { include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
      if (!user) {
        return res.status(404).json({ success: false, code: 404, message: 'User not found' });
      }
      return res.status(200).json({ success: true, code: 200, message: 'User details fetched', data: user });
    } else {
      return res.status(400).json({ success: false, code: 400, message: 'Invalid user type' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, message: 'Error fetching details', error: err.message });
  }
}; 