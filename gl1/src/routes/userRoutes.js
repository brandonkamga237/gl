const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAdmin } = require('../middlewares/authMiddleware');
const {
  validateCreateUser,
  validateUpdateUser,
  validateLogin,
  validateRegister,
} = require('../middlewares/validationMiddleware');

router.post('/', validateCreateUser, userController.createUser);
router.get('/', requireAdmin, userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', validateUpdateUser, userController.updateUser);
router.delete('/:id', requireAdmin, userController.deleteUser);
router.post('/:id/account', userController.createAccount);
router.get('/:id/account', userController.getBalance);

module.exports = router;
