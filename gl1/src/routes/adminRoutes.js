const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdminCookie } = require('../middlewares/authMiddleware');

router.get('/login', adminController.loginForm);
router.post('/login', adminController.loginAction);
router.get('/logout', adminController.logout);

router.use(requireAdminCookie);

router.get('/', (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', adminController.dashboard);
router.get('/users', adminController.listUsers);
router.get('/users/create', adminController.createUserForm);
router.post('/users/create', adminController.createUserAction);
router.get('/users/:id/edit', adminController.editUserForm);
router.post('/users/:id/edit', adminController.editUserAction);
router.post('/users/:id/delete', adminController.deleteUserAction);
router.get('/transactions', adminController.listTransactions);

module.exports = router;
