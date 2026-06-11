const userService = require('../services/userService');
const transactionService = require('../services/transactionService');

const dashboard = async (req, res) => {
  try {
    const [stats, recentTx] = await Promise.all([
      transactionService.getDashboardStats(),
      transactionService.getHistory(null, 10),
    ]);
    res.render('admin/dashboard', { title: 'Tableau de bord', stats, recentTx, admin: req.user, layout: 'layouts/admin' });
  } catch (e) {
    res.render('admin/dashboard', { title: 'Tableau de bord', stats: {}, recentTx: [], admin: req.user, layout: 'layouts/admin' });
  }
};

const clients = async (req, res) => {
  try {
    const clients = await userService.getAllUsers();
    res.render('admin/clients', { title: 'Clients', clients, admin: req.user, layout: 'layouts/admin' });
  } catch (e) {
    res.redirect('/admin/dashboard');
  }
};

const toggleActive = async (req, res) => {
  await userService.toggleActive(req.params.id).catch(() => {});
  res.redirect('/admin/clients');
};

module.exports = { dashboard, clients, toggleActive };
