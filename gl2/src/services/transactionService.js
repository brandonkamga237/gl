const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Transaction } = require('../models');

const deposit = async (userId, amount, description = '') => {
  if (!amount || parseFloat(amount) <= 0) throw new Error('INVALID_AMOUNT');

  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, { lock: true, transaction: t });
    if (!user) throw new Error('USER_NOT_FOUND');

    const balanceBefore = parseFloat(user.balance);
    const balanceAfter = balanceBefore + parseFloat(amount);
    await user.update({ balance: balanceAfter }, { transaction: t });

    return Transaction.create({
      userId, type: 'deposit',
      amount: parseFloat(amount),
      balanceBefore, balanceAfter, description,
    }, { transaction: t });
  });
};

const withdraw = async (userId, amount, description = '') => {
  if (!amount || parseFloat(amount) <= 0) throw new Error('INVALID_AMOUNT');

  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, { lock: true, transaction: t });
    if (!user) throw new Error('USER_NOT_FOUND');

    const balanceBefore = parseFloat(user.balance);
    if (balanceBefore < parseFloat(amount)) throw new Error('INSUFFICIENT_FUNDS');

    const balanceAfter = balanceBefore - parseFloat(amount);
    await user.update({ balance: balanceAfter }, { transaction: t });

    return Transaction.create({
      userId, type: 'withdraw',
      amount: parseFloat(amount),
      balanceBefore, balanceAfter, description,
    }, { transaction: t });
  });
};

const transfer = async (fromUserId, toIdentifier, amount, description = '') => {
  if (!amount || parseFloat(amount) <= 0) throw new Error('INVALID_AMOUNT');
  if (!toIdentifier) throw new Error('RECIPIENT_REQUIRED');

  return sequelize.transaction(async (t) => {
    const sender = await User.findByPk(fromUserId, { lock: true, transaction: t });
    if (!sender) throw new Error('USER_NOT_FOUND');

    const { Op } = require('sequelize');
    const recipient = await User.findOne({
      where: { [Op.or]: [{ accountNumber: toIdentifier }, { email: toIdentifier }] },
      lock: true, transaction: t,
    });
    if (!recipient) throw new Error('RECIPIENT_NOT_FOUND');
    if (recipient.id === fromUserId) throw new Error('SELF_TRANSFER');

    const amt = parseFloat(amount);
    const senderBefore = parseFloat(sender.balance);
    if (senderBefore < amt) throw new Error('INSUFFICIENT_FUNDS');

    const recipientBefore = parseFloat(recipient.balance);

    await sender.update({ balance: senderBefore - amt }, { transaction: t });
    await recipient.update({ balance: recipientBefore + amt }, { transaction: t });

    const label = description || `Virement vers ${recipient.name}`;
    const labelIn = `Virement de ${sender.name}`;

    const txOut = await Transaction.create({
      userId: fromUserId, type: 'transfer_out',
      amount: amt, balanceBefore: senderBefore, balanceAfter: senderBefore - amt,
      description: label, counterpartId: recipient.id,
    }, { transaction: t });

    await Transaction.create({
      userId: recipient.id, type: 'transfer_in',
      amount: amt, balanceBefore: recipientBefore, balanceAfter: recipientBefore + amt,
      description: labelIn, counterpartId: fromUserId,
    }, { transaction: t });

    return { txOut, recipient: { name: recipient.name, accountNumber: recipient.accountNumber } };
  });
};

const getHistory = async (userId, limit = null) => {
  const opts = {
    include: [{ model: User, as: 'user', attributes: ['name', 'accountNumber'] }],
    order: [['createdAt', 'DESC']],
  };
  if (userId) opts.where = { userId };
  if (limit) opts.limit = limit;
  return Transaction.findAll(opts);
};

const getDashboardStats = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalClients, activeClients, totalTransactions, weekDepResult, weekWithResult, transferResult] = await Promise.all([
    User.count({ where: { role: 'client' } }),
    User.count({ where: { role: 'client', isActive: true } }),
    Transaction.count(),
    Transaction.findAll({
      where: { type: 'deposit', createdAt: { [Op.gte]: sevenDaysAgo } },
      attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      raw: true,
    }),
    Transaction.findAll({
      where: { type: 'withdraw', createdAt: { [Op.gte]: sevenDaysAgo } },
      attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
      raw: true,
    }),
    Transaction.count({ where: { type: 'transfer_out' } }),
  ]);

  const txByDay = await Transaction.findAll({
    attributes: [
      [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')), 'day'],
      'type',
      [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'count'],
    ],
    where: { createdAt: { [Op.gte]: sevenDaysAgo } },
    group: [
      sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')),
      'type',
    ],
    raw: true,
  });

  const joursFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const countForDay = (d, type) => {
    const key = d.toISOString().split('T')[0];
    const found = txByDay.find(tx =>
      new Date(tx.day).toISOString().split('T')[0] === key && tx.type === type
    );
    return found ? parseInt(found.count) : 0;
  };

  return {
    totalClients,
    activeClients,
    totalTransactions,
    totalTransfers: transferResult,
    weekDeposits: parseFloat((weekDepResult[0] && weekDepResult[0].total) || 0),
    weekWithdrawals: parseFloat((weekWithResult[0] && weekWithResult[0].total) || 0),
    chartLabels: last7.map(d => joursFr[d.getDay()] + ' ' + d.getDate()),
    chartDeposits: last7.map(d => countForDay(d, 'deposit')),
    chartWithdrawals: last7.map(d => countForDay(d, 'withdraw')),
  };
};

module.exports = { deposit, withdraw, transfer, getHistory, getDashboardStats };
