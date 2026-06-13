const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Transaction, BankAccount } = require('../models');
const { BANK_MASTER_ID } = require('../models/BankAccount');

// ─── Barème des frais ─────────────────────────────────────────────────────
const FEE_CONFIG = {
  withdraw:          { rate: 0.01,  min: 500,  fixed: 0    },
  transfer_internal: { rate: 0.005, min: 200,  fixed: 0    },
  transfer_external: { rate: 0.02,  min: 1000, fixed: 1000 },
};

/**
 * Calcule les frais pour un type d'opération donné.
 * - Retrait       : max(montant × 1%, 500 FCFA)
 * - Virement int. : max(montant × 0.5%, 200 FCFA)
 * - Virement ext. : max(montant × 2%, 1000 FCFA) + 1000 FCFA fixe
 * - Dépôt (admin) : gratuit (0 FCFA)
 */
const calculateFee = (amount, type) => {
  const cfg = FEE_CONFIG[type];
  if (!cfg) return 0;
  const computed = Math.ceil(parseFloat(amount) * cfg.rate);
  return Math.max(computed, cfg.min) + cfg.fixed;
};

// ─── Récupère (ou crée) le compte maître de la banque ────────────────────
const getBank = async (t) => {
  let bank = await BankAccount.findByPk(BANK_MASTER_ID, { lock: true, transaction: t });
  if (!bank) {
    bank = await BankAccount.create({
      id: BANK_MASTER_ID,
      balance: 50000000.00,
    }, { transaction: t });
  }
  return bank;
};

// ─── Dépôt (admin → compte client) ───────────────────────────────────────
// Seul l'admin peut créditer un compte. La vérification du rôle est faite
// au niveau du middleware (requireAdmin) ; le service gère uniquement la
// logique métier.
const deposit = async (targetUserId, amount, description = '') => {
  if (!amount || parseFloat(amount) <= 0) throw new Error('INVALID_AMOUNT');

  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(targetUserId, { lock: true, transaction: t });
    if (!user) throw new Error('USER_NOT_FOUND');

    const bank = await getBank(t);

    const balanceBefore = parseFloat(user.balance);
    const balanceAfter  = balanceBefore + parseFloat(amount);

    await user.update({ balance: balanceAfter }, { transaction: t });
    await bank.update({
      balance:        parseFloat(bank.balance) - parseFloat(amount),
      totalDeposited: parseFloat(bank.totalDeposited) + parseFloat(amount),
    }, { transaction: t });

    return Transaction.create({
      userId: targetUserId,
      type: 'deposit',
      amount: parseFloat(amount),
      fees: 0,
      balanceBefore,
      balanceAfter,
      description,
    }, { transaction: t });
  });
};

// ─── Retrait (client → espèces, avec frais) ──────────────────────────────
// Le client paie montant + frais. Les frais restent dans la banque.
// L'argent retiré (montant net) quitte le système bancaire.
const withdraw = async (userId, amount, description = '') => {
  if (!amount || parseFloat(amount) <= 0) throw new Error('INVALID_AMOUNT');

  const fees         = calculateFee(amount, 'withdraw');
  const totalDeducted = parseFloat(amount) + fees;

  return sequelize.transaction(async (t) => {
    const user = await User.findByPk(userId, { lock: true, transaction: t });
    if (!user) throw new Error('USER_NOT_FOUND');

    const bank = await getBank(t);

    const balanceBefore = parseFloat(user.balance);
    if (balanceBefore < totalDeducted) throw new Error('INSUFFICIENT_FUNDS');

    const balanceAfter = balanceBefore - totalDeducted;

    await user.update({ balance: balanceAfter }, { transaction: t });
    await bank.update({
      balance:            parseFloat(bank.balance) + fees,
      totalFeesCollected: parseFloat(bank.totalFeesCollected) + fees,
      totalWithdrawn:     parseFloat(bank.totalWithdrawn) + parseFloat(amount),
    }, { transaction: t });

    return Transaction.create({
      userId,
      type: 'withdraw',
      amount: parseFloat(amount),
      fees,
      balanceBefore,
      balanceAfter,
      description,
    }, { transaction: t });
  });
};

// ─── Virement (client → client interne ou banque externe) ────────────────
// Frais différenciés : virement interne < virement externe.
// Pour un virement interne : le destinataire reçoit le montant exact ;
// seul l'émetteur paye les frais.
const transfer = async (fromUserId, toIdentifier, amount, isExternal = false, description = '') => {
  if (!amount || parseFloat(amount) <= 0) throw new Error('INVALID_AMOUNT');
  if (!toIdentifier) throw new Error('RECIPIENT_REQUIRED');

  const txType       = isExternal ? 'transfer_external' : 'transfer_internal';
  const fees         = calculateFee(amount, txType);
  const totalDeducted = parseFloat(amount) + fees;

  return sequelize.transaction(async (t) => {
    const sender = await User.findByPk(fromUserId, { lock: true, transaction: t });
    if (!sender) throw new Error('USER_NOT_FOUND');

    const bank = await getBank(t);

    const senderBefore = parseFloat(sender.balance);
    if (senderBefore < totalDeducted) throw new Error('INSUFFICIENT_FUNDS');

    let recipient = null;
    if (!isExternal) {
      recipient = await User.findOne({
        where: { [Op.or]: [{ id: toIdentifier }, { email: toIdentifier }] },
        lock: true,
        transaction: t,
      });
      if (!recipient) throw new Error('RECIPIENT_NOT_FOUND');
      if (recipient.id === fromUserId) throw new Error('SELF_TRANSFER');
    }

    const senderAfter = senderBefore - totalDeducted;
    await sender.update({ balance: senderAfter }, { transaction: t });

    await bank.update({
      balance:            parseFloat(bank.balance) + fees,
      totalFeesCollected: parseFloat(bank.totalFeesCollected) + fees,
    }, { transaction: t });

    const label = description || (isExternal
      ? `Virement externe vers ${toIdentifier}`
      : `Virement vers ${recipient.name}`);

    const senderTx = await Transaction.create({
      userId: fromUserId,
      type: txType,
      amount: parseFloat(amount),
      fees,
      balanceBefore: senderBefore,
      balanceAfter: senderAfter,
      description: label,
      recipientId: recipient ? recipient.id : null,
      externalBank: isExternal ? String(toIdentifier) : null,
    }, { transaction: t });

    // Enregistrement côté destinataire (interne uniquement)
    if (!isExternal && recipient) {
      const recipientBefore = parseFloat(recipient.balance);
      const recipientAfter  = recipientBefore + parseFloat(amount);
      await recipient.update({ balance: recipientAfter }, { transaction: t });

      await Transaction.create({
        userId: recipient.id,
        type: 'transfer_received',
        amount: parseFloat(amount),
        fees: 0,
        balanceBefore: recipientBefore,
        balanceAfter: recipientAfter,
        description: `Virement reçu de ${sender.name}`,
        recipientId: fromUserId,
      }, { transaction: t });
    }

    return { transaction: senderTx, recipient, fees, isExternal };
  });
};

// ─── Lecture ──────────────────────────────────────────────────────────────
const getAllTransactions = async () => {
  return Transaction.findAll({
    include: [{ association: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
};

const getTransactionsByUserId = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return Transaction.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
};

const getStats = async () => {
  const totalUsers        = await User.count();
  const totalTransactions = await Transaction.count();

  const [depositResult, withdrawResult, feeResult] = await Promise.all([
    Transaction.findAll({ where: { type: 'deposit' },  attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']], raw: true }),
    Transaction.findAll({ where: { type: 'withdraw' }, attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']], raw: true }),
    Transaction.findAll({
      where: { type: ['withdraw', 'transfer_internal', 'transfer_external'] },
      attributes: [[sequelize.fn('SUM', sequelize.col('fees')), 'total']],
      raw: true,
    }),
  ]);

  return {
    totalUsers,
    totalTransactions,
    totalDeposits:    parseFloat((depositResult[0]  && depositResult[0].total)  || 0),
    totalWithdrawals: parseFloat((withdrawResult[0] && withdrawResult[0].total) || 0),
    totalFees:        parseFloat((feeResult[0]       && feeResult[0].total)      || 0),
  };
};

const getDashboardStats = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalClients, activeClients, totalTransactions,
    depositResult, withdrawResult, totalBalanceResult,
    txByDay, recentTransactions, recentClients, bankAccount,
  ] = await Promise.all([
    User.count({ where: { role: 'client' } }),
    User.count({ where: { role: 'client', isActive: true } }),
    Transaction.count(),
    Transaction.findAll({ where: { type: 'deposit' },  attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']], raw: true }),
    Transaction.findAll({ where: { type: 'withdraw' }, attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']], raw: true }),
    User.findAll({ attributes: [[sequelize.fn('SUM', sequelize.col('balance')), 'total']], where: { role: 'client' }, raw: true }),
    Transaction.findAll({
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')), 'day'],
        'type',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: sevenDaysAgo } },
      group: [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')), 'type'],
      order: [[sequelize.fn('DATE_TRUNC', 'day', sequelize.col('Transaction.createdAt')), 'ASC']],
      raw: true,
    }),
    Transaction.findAll({ include: [{ association: 'user', attributes: ['name'] }], order: [['createdAt', 'DESC']], limit: 8 }),
    User.findAll({ attributes: { exclude: ['password'] }, where: { role: 'client' }, order: [['createdAt', 'DESC']], limit: 5 }),
    BankAccount.findByPk(BANK_MASTER_ID),
  ]);

  const joursFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    last7.push(d);
  }

  const chartLabels = last7.map(d => joursFr[d.getDay()] + ' ' + d.getDate());

  const findDay = (d, type) => {
    const key = d.toISOString().split('T')[0];
    const found = txByDay.find(tx => new Date(tx.day).toISOString().split('T')[0] === key && tx.type === type);
    return found ? parseFloat(found.total) : 0;
  };

  return {
    totalClients,
    activeClients,
    totalTransactions,
    totalDeposits:    parseFloat((depositResult[0]  && depositResult[0].total)  || 0),
    totalWithdrawals: parseFloat((withdrawResult[0] && withdrawResult[0].total) || 0),
    totalBalance:     parseFloat((totalBalanceResult[0] && totalBalanceResult[0].total) || 0),
    bankBalance:      bankAccount ? parseFloat(bankAccount.balance) : 0,
    bankFees:         bankAccount ? parseFloat(bankAccount.totalFeesCollected) : 0,
    recentTransactions,
    recentClients,
    chartLabels,
    chartDeposits:    last7.map(d => findDay(d, 'deposit')),
    chartWithdrawals: last7.map(d => findDay(d, 'withdraw')),
  };
};

module.exports = {
  calculateFee,
  deposit,
  withdraw,
  transfer,
  getAllTransactions,
  getTransactionsByUserId,
  getStats,
  getDashboardStats,
};
