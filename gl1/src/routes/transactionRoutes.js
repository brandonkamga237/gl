const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');
const { validateTransaction, validateTransfer } = require('../middlewares/validationMiddleware');

// Dépôt : réservé à l'admin (seul l'admin alimente les comptes)
router.post('/deposit', requireAdmin, validateTransaction, transactionController.deposit);

// Retrait : n'importe quel utilisateur authentifié
router.post('/withdraw', verifyToken, validateTransaction, transactionController.withdraw);

// Virement : n'importe quel utilisateur authentifié
router.post('/transfer', verifyToken, validateTransfer, transactionController.transfer);

// Historique global (admin) et par utilisateur
router.get('/',         requireAdmin, transactionController.getAllTransactions);
router.get('/:userId',  verifyToken,  transactionController.getTransactionsByUserId);

module.exports = router;
