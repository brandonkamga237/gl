const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { requireClientCookie } = require('../middlewares/authMiddleware');

router.get('/login', clientController.loginForm);
router.post('/login', clientController.loginAction);
router.get('/logout', clientController.logout);

router.use(requireClientCookie);

router.get('/', (req, res) => res.redirect('/client/dashboard'));
router.get('/dashboard', clientController.dashboard);
router.get('/deposit', clientController.depositForm);
router.post('/deposit', clientController.depositAction);
router.get('/withdraw', clientController.withdrawForm);
router.post('/withdraw', clientController.withdrawAction);
router.get('/transactions', clientController.transactions);

module.exports = router;
