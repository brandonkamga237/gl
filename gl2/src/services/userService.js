const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
const SECRET = () => process.env.JWT_SECRET || 'fallback_secret';

const register = async ({ name, email, password, phone }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('EMAIL_ALREADY_EXISTS');

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, password: hashed, phone, role: 'client', balance: 0 });

  const { password: _, ...safe } = user.toJSON();
  return safe;
};

const login = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new Error('INVALID_CREDENTIALS');
  if (!user.isActive) throw new Error('ACCOUNT_DISABLED');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    SECRET(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const { password: _, ...safe } = user.toJSON();
  return { user: safe, token };
};

const getProfile = async (id) => {
  const user = await User.findByPk(id, { attributes: { exclude: ['password'] } });
  if (!user) throw new Error('USER_NOT_FOUND');
  return user;
};

const getAllUsers = async () => {
  return User.findAll({ attributes: { exclude: ['password'] }, order: [['createdAt', 'DESC']] });
};

const toggleActive = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('USER_NOT_FOUND');
  await user.update({ isActive: !user.isActive });
  const { password: _, ...safe } = user.toJSON();
  return safe;
};

const findByAccountOrEmail = async (identifier) => {
  const { Op } = require('sequelize');
  const user = await User.findOne({
    where: {
      [Op.or]: [{ accountNumber: identifier }, { email: identifier }],
    },
    attributes: { exclude: ['password'] },
  });
  return user;
};

module.exports = { register, login, getProfile, getAllUsers, toggleActive, findByAccountOrEmail };
