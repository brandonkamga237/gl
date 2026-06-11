const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');
const { validateTransaction } = require('../middlewares/validationMiddleware');

router.post('/deposit', verifyToken, validateTransaction, transactionController.deposit);
router.post('/withdraw', verifyToken, validateTransaction, transactionController.withdraw);
router.get('/', requireAdmin, transactionController.getAllTransactions);
router.get('/:userId', verifyToken, transactionController.getTransactionsByUserId);

module.exports = router;
