const userService = require('../services/userService');
const transactionService = require('../services/transactionService');

const dashboard = async (req, res) => {
  try {
    const stats = await transactionService.getDashboardStats();
    res.render('dashboard', {
      title: 'Tableau de bord',
      stats,
      user: req.adminUser,
    });
  } catch (error) {
    res.render('error', { message: error.message });
  }
};

const listUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.render('users/index', { title: 'Gestion des clients', users, user: req.adminUser });
  } catch (error) {
    res.render('error', { message: error.message });
  }
};

const createUserForm = (req, res) => {
  res.render('users/create', { title: 'Nouveau client', user: req.adminUser, errors: [] });
};

const createUserAction = async (req, res) => {
  try {
    await userService.createUser(req.body);
    res.redirect('/admin/users');
  } catch (error) {
    const errors = [{ msg: error.message === 'EMAIL_ALREADY_EXISTS' ? 'Cet email est déjà utilisé' : error.message }];
    res.render('users/create', { title: 'Nouveau client', user: req.adminUser, errors });
  }
};

const editUserForm = async (req, res) => {
  try {
    const targetUser = await userService.getUserById(req.params.id);
    res.render('users/edit', { title: 'Modifier le client', targetUser, user: req.adminUser, errors: [] });
  } catch (error) {
    res.redirect('/admin/users');
  }
};

const editUserAction = async (req, res) => {
  try {
    if (req.body.isActive === 'true') req.body.isActive = true;
    else if (req.body.isActive === undefined) req.body.isActive = false;
    await userService.updateUser(req.params.id, req.body);
    res.redirect('/admin/users');
  } catch (error) {
    const errors = [{ msg: error.message }];
    const targetUser = { id: req.params.id, ...req.body };
    res.render('users/edit', { title: 'Modifier le client', targetUser, user: req.adminUser, errors });
  }
};

const deleteUserAction = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
  } catch (error) { /* silent */ }
  res.redirect('/admin/users');
};

const listTransactions = async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions();
    res.render('transactions/index', { title: 'Historique des transactions', transactions, user: req.adminUser });
  } catch (error) {
    res.render('error', { message: error.message });
  }
};

const loginForm = (req, res) => {
  res.render('auth/login', { title: 'Connexion Administrateur', error: null, layout: false });
};

const loginAction = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await userService.login(email, password);
    if (result.user.role !== 'admin') {
      return res.render('auth/login', { title: 'Connexion Administrateur', error: 'Accès réservé aux administrateurs', layout: false });
    }
    res.cookie('adminToken', result.token, { httpOnly: true, maxAge: 86400000 });
    res.redirect('/admin/dashboard');
  } catch (error) {
    res.render('auth/login', { title: 'Connexion Administrateur', error: 'Email ou mot de passe incorrect', layout: false });
  }
};

const logout = (req, res) => {
  res.clearCookie('adminToken');
  res.redirect('/admin/login');
};

module.exports = {
  dashboard,
  listUsers,
  createUserForm,
  createUserAction,
  editUserForm,
  editUserAction,
  deleteUserAction,
  listTransactions,
  loginForm,
  loginAction,
  logout,
};
