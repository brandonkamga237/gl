const userService = require('../services/userService');

const createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return res.status(200).json({ success: true, data: users, count: users.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const result = await userService.deleteUser(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createAccount = async (req, res) => {
  try {
    const account = await userService.createAccount(req.params.id);
    return res.status(201).json({ success: true, data: account });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBalance = async (req, res) => {
  try {
    const balance = await userService.getBalance(req.params.id);
    return res.status(200).json({ success: true, data: balance });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const register = async (req, res) => {
  try {
    const user = await userService.register(req.body);
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const result = await userService.login(req.body.email, req.body.password);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (error.message === 'ACCOUNT_DISABLED') {
      return res.status(403).json({ success: false, message: 'Account is disabled' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createAccount,
  getBalance,
  register,
  login,
};
