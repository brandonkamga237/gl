const transactionService = require('../services/transactionService');

const deposit = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const transaction = await transactionService.deposit(userId, amount, description);
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND')   return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    if (error.message === 'INVALID_AMOUNT')   return res.status(400).json({ success: false, message: 'Le montant doit être supérieur à 0' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

const withdraw = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const transaction = await transactionService.withdraw(userId, amount, description);
    return res.status(201).json({
      success: true,
      data: transaction,
      fees: transaction.fees,
      message: `Retrait effectué — frais : ${parseFloat(transaction.fees).toLocaleString('fr-FR')} FCFA`,
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND')      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    if (error.message === 'INVALID_AMOUNT')      return res.status(400).json({ success: false, message: 'Le montant doit être supérieur à 0' });
    if (error.message === 'INSUFFICIENT_FUNDS')  return res.status(422).json({ success: false, message: 'Solde insuffisant (montant + frais)' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

const transfer = async (req, res) => {
  try {
    const { toIdentifier, amount, isExternal, description } = req.body;
    const fromUserId = req.user.id;
    const external = isExternal === true || isExternal === 'true';

    const result = await transactionService.transfer(fromUserId, toIdentifier, amount, external, description);
    return res.status(201).json({
      success: true,
      data: result.transaction,
      fees: result.fees,
      isExternal: result.isExternal,
      message: `Virement effectué — frais : ${result.fees.toLocaleString('fr-FR')} FCFA`,
    });
  } catch (error) {
    const map = {
      INVALID_AMOUNT:     [400, 'Le montant doit être supérieur à 0'],
      RECIPIENT_REQUIRED: [400, 'Destinataire requis'],
      USER_NOT_FOUND:     [404, 'Émetteur introuvable'],
      RECIPIENT_NOT_FOUND:[404, 'Destinataire introuvable'],
      SELF_TRANSFER:      [422, 'Auto-virement interdit'],
      INSUFFICIENT_FUNDS: [422, 'Solde insuffisant (montant + frais)'],
    };
    const [status, message] = map[error.message] || [500, error.message];
    return res.status(status).json({ success: false, message });
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
    if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { deposit, withdraw, transfer, getAllTransactions, getTransactionsByUserId };
