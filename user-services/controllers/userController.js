const User = require('../models/user');
const Role = require('../../permission-service/models/roles');
const sendMail = require('../../Utils/sendMail');
const bcrypt = require('bcryptjs');

// Create a new user
exports.createUser = async (req, res) => {
  try {
    const { full_name, email, role_id, status, password } = req.body;
    if (!full_name || !email || !role_id || !password) {
      return res.status(400).json({ message: 'full_name, email, role_id, and password are required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    let user = await User.create({ full_name, email, role_id, status, password: hashedPassword });
    await user.save();

    // Send welcome email to user
    const subject = 'Welcome to Our Platform!';
    const html = `
      <h2>Welcome, ${full_name}!</h2>
      <p>Your user account has been created. Here are your details:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Email:</strong> ${password}</li>
        <li><strong>Status:</strong> ${status || 'Active'}</li>
      </ul>
      <p>Please log in to your account.</p>
      <br>
      <p>Best regards,<br>Your App Team</p>
    `;
    await sendMail({ to: email, subject, html });

    return res.status(201).json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Error creating user', error: err.message });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

// Get a user by id
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
};

// Update a user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role_id, status } = req.body;
    const [updated] = await User.update({ full_name, role_id, status }, { where: { user_id: id } });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    const user = await User.findByPk(id, { include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] });
    await user.save();
    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Error updating user', error: err.message });
  }
};

// Delete a user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.destroy({ where: { user_id: id } });
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
}; 