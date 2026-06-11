const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

const createUser = async ({ name, email, password, role = 'client', balance = 0 }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    balance: parseFloat(balance) || 0,
  });

  const { password: _, ...userWithoutPassword } = user.toJSON();
  return userWithoutPassword;
};

const getAllUsers = async () => {
  const users = await User.findAll({
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
  });
  return users;
};

const getUserById = async (id) => {
  const user = await User.findByPk(id, {
    attributes: { exclude: ['password'] },
  });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  return user;
};

const updateUser = async (id, { name, email, password, role, isActive }) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (email && email !== user.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) {
    updates.password = await bcrypt.hash(password, SALT_ROUNDS);
  }

  await user.update(updates);

  const { password: _, ...userWithoutPassword } = user.toJSON();
  return userWithoutPassword;
};

const deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  await user.destroy();
  return { message: 'User deleted successfully' };
};

const login = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new Error('ACCOUNT_DISABLED');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const { password: _, ...userWithoutPassword } = user.toJSON();
  return { user: userWithoutPassword, token };
};

const register = async ({ name, email, password }) => {
  return createUser({ name, email, password, role: 'client', balance: 0 });
};

const getBalance = async (id) => {
  const user = await User.findByPk(id, {
    attributes: ['id', 'name', 'email', 'balance'],
  });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  return { userId: user.id, name: user.name, balance: parseFloat(user.balance) };
};

const createAccount = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  return { userId: user.id, name: user.name, balance: parseFloat(user.balance) };
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  login,
  register,
  getBalance,
  createAccount,
};
