const transactionService = require('../services/transactionService');

const deposit = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const transaction = await transactionService.deposit(userId, amount, description);
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (error.message === 'INVALID_AMOUNT') {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const withdraw = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const transaction = await transactionService.withdraw(userId, amount, description);
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (error.message === 'INVALID_AMOUNT') {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(422).json({ success: false, message: 'Insufficient funds' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions();
    return res.status(200).json({ success: true, data: transactions, count: transactions.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTransactionsByUserId = async (req, res) => {
  try {
    const transactions = await transactionService.getTransactionsByUserId(req.params.userId);
    return res.status(200).json({ success: true, data: transactions, count: transactions.length });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { deposit, withdraw, getAllTransactions, getTransactionsByUserId };
