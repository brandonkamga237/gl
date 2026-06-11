const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Transaction } = require('../models');

const deposit = async (userId, amount, description = '') => {
  if (!amount || amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const result = await sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, { lock: true, transaction: t });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const balanceBefore = parseFloat(user.balance);
    const balanceAfter = balanceBefore + parseFloat(amount);

    await user.update({ balance: balanceAfter }, { transaction: t });

    const transaction = await Transaction.create({
      userId,
      type: 'deposit',
      amount: parseFloat(amount),
      balanceBefore,
      balanceAfter,
      description,
    }, { transaction: t });

    return transaction;
  });

  return result;
};

const withdraw = async (userId, amount, description = '') => {
  if (!amount || amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const result = await sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, { lock: true, transaction: t });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const balanceBefore = parseFloat(user.balance);
    if (balanceBefore < parseFloat(amount)) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const balanceAfter = balanceBefore - parseFloat(amount);

    await user.update({ balance: balanceAfter }, { transaction: t });

    const transaction = await Transaction.create({
      userId,
      type: 'withdraw',
      amount: parseFloat(amount),
      balanceBefore,
      balanceAfter,
      description,
    }, { transaction: t });

    return transaction;
  });

  return result;
};

const getAllTransactions = async () => {
  const transactions = await Transaction.findAll({
    include: [{ association: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  return transactions;
};

const getTransactionsByUserId = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const transactions = await Transaction.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
  return transactions;
};

const getStats = async () => {
  const totalUsers = await User.count();
  const totalTransactions = await Transaction.count();

  const depositResult = await Transaction.findAll({
    where: { type: 'deposit' },
    attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
    raw: true,
  });

  const withdrawResult = await Transaction.findAll({
    where: { type: 'withdraw' },
    attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
    raw: true,
  });

  return {
    totalUsers,
    totalTransactions,
    totalDeposits: parseFloat((depositResult[0] && depositResult[0].total) || 0),
    totalWithdrawals: parseFloat((withdrawResult[0] && withdrawResult[0].total) || 0),
  };
};

const getDashboardStats = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalClients,
    activeClients,
    totalTransactions,
    depositResult,
    withdrawResult,
    totalBalanceResult,
    txByDay,
    recentTransactions,
    recentClients,
  ] = await Promise.all([
    User.count({ where: { role: 'client' } }),
    User.count({ where: { role: 'client', isActive: true } }),
    Transaction.count(),
    Transaction.findAll({
      where: { type: 'deposit' },
      attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      raw: true,
    }),
    Transaction.findAll({
      where: { type: 'withdraw' },
      attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      raw: true,
    }),
    User.findAll({
      attributes: [[sequelize.fn('SUM', sequelize.col('balance')), 'total']],
      where: { role: 'client' },
      raw: true,
    }),
    Transaction.findAll({
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')), 'day'],
        'type',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: sevenDaysAgo } },
      group: [
        sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')),
        'type',
      ],
      order: [[sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')), 'ASC']],
      raw: true,
    }),
    Transaction.findAll({
      include: [{ association: 'user', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 8,
    }),
    User.findAll({
      attributes: { exclude: ['password'] },
      where: { role: 'client' },
      order: [['createdAt', 'DESC']],
      limit: 5,
    }),
  ]);

  // Générer les 7 derniers jours
  const joursFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    last7.push(d);
  }

  const chartLabels = last7.map(d => joursFr[d.getDay()] + ' ' + d.getDate());

  const chartDeposits = last7.map(d => {
    const key = d.toISOString().split('T')[0];
    const found = txByDay.find(tx => {
      return new Date(tx.day).toISOString().split('T')[0] === key && tx.type === 'deposit';
    });
    return found ? parseFloat(found.total) : 0;
  });

  const chartWithdrawals = last7.map(d => {
    const key = d.toISOString().split('T')[0];
    const found = txByDay.find(tx => {
      return new Date(tx.day).toISOString().split('T')[0] === key && tx.type === 'withdraw';
    });
    return found ? parseFloat(found.total) : 0;
  });

  const totalDeposits = parseFloat((depositResult[0] && depositResult[0].total) || 0);
  const totalWithdrawals = parseFloat((withdrawResult[0] && withdrawResult[0].total) || 0);

  return {
    totalClients,
    activeClients,
    totalTransactions,
    totalDeposits,
    totalWithdrawals,
    totalBalance: parseFloat((totalBalanceResult[0] && totalBalanceResult[0].total) || 0),
    recentTransactions,
    recentClients,
    chartLabels,
    chartDeposits,
    chartWithdrawals,
    depositCount: txByDay.filter(tx => tx.type === 'deposit').reduce((s, tx) => s + parseInt(tx.count), 0),
    withdrawCount: txByDay.filter(tx => tx.type === 'withdraw').reduce((s, tx) => s + parseInt(tx.count), 0),
  };
};

module.exports = {
  deposit,
  withdraw,
  getAllTransactions,
  getTransactionsByUserId,
  getStats,
  getDashboardStats,
};
