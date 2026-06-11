const userService = require('../services/userService');
const transactionService = require('../services/transactionService');

const loginForm = (req, res) => {
  const error = req.query.error || null;
  res.render('client/login', { title: 'Connexion', error, layout: false });
};

const loginAction = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.redirect('/client/login?error=Veuillez remplir tous les champs');
    }
    const result = await userService.login(email, password);
    if (result.user.role === 'admin') {
      return res.redirect('/admin/login');
    }
    res.cookie('clientToken', result.token, { httpOnly: true, maxAge: 86400000 });
    res.redirect('/client/dashboard');
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.redirect('/client/login?error=Email ou mot de passe incorrect');
    }
    if (error.message === 'ACCOUNT_DISABLED') {
      return res.redirect('/client/login?error=Votre compte est désactivé, contactez votre agence');
    }
    res.redirect('/client/login?error=Une erreur est survenue');
  }
};

const dashboard = async (req, res) => {
  try {
    const userId = req.clientUser.id;
    const [balanceData, transactions] = await Promise.all([
      userService.getBalance(userId),
      transactionService.getTransactionsByUserId(userId),
    ]);
    const recent = transactions.slice(0, 5);
    res.render('client/dashboard', {
      title: 'Mon Compte',
      client: req.clientUser,
      balance: balanceData.balance,
      name: balanceData.name,
      recentTransactions: recent,
      layout: 'layouts/client',
    });
  } catch (error) {
    res.redirect('/client/login?error=Session expirée');
  }
};

const depositForm = (req, res) => {
  const error = req.query.error || null;
  const success = req.query.success || null;
  res.render('client/deposit', {
    title: 'Effectuer un dépôt',
    client: req.clientUser,
    error,
    success,
    layout: 'layouts/client',
  });
};

const depositAction = async (req, res) => {
  try {
    const userId = req.clientUser.id;
    const amount = parseFloat(req.body.amount);
    const description = req.body.description || '';

    if (!amount || amount <= 0) {
      return res.redirect('/client/deposit?error=Le montant doit être supérieur à 0 FCFA');
    }
    if (amount < 100) {
      return res.redirect('/client/deposit?error=Le dépôt minimum est de 100 FCFA');
    }

    await transactionService.deposit(userId, amount, description);
    res.redirect('/client/deposit?success=Votre dépôt de ' + amount.toLocaleString('fr-FR') + ' FCFA a bien été enregistré');
  } catch (error) {
    res.redirect('/client/deposit?error=Une erreur est survenue lors du dépôt');
  }
};

const withdrawForm = async (req, res) => {
  const error = req.query.error || null;
  const success = req.query.success || null;
  try {
    const balanceData = await userService.getBalance(req.clientUser.id);
    res.render('client/withdraw', {
      title: 'Effectuer un retrait',
      client: req.clientUser,
      balance: balanceData.balance,
      error,
      success,
      layout: 'layouts/client',
    });
  } catch (e) {
    res.redirect('/client/dashboard');
  }
};

const withdrawAction = async (req, res) => {
  try {
    const userId = req.clientUser.id;
    const amount = parseFloat(req.body.amount);
    const description = req.body.description || '';

    if (!amount || amount <= 0) {
      return res.redirect('/client/withdraw?error=Le montant doit être supérieur à 0 FCFA');
    }

    await transactionService.withdraw(userId, amount, description);
    res.redirect('/client/withdraw?success=Votre retrait de ' + amount.toLocaleString('fr-FR') + ' FCFA a bien été effectué');
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.redirect('/client/withdraw?error=Solde insuffisant pour effectuer ce retrait');
    }
    res.redirect('/client/withdraw?error=Une erreur est survenue lors du retrait');
  }
};

const transactions = async (req, res) => {
  try {
    const userId = req.clientUser.id;
    const [balanceData, allTransactions] = await Promise.all([
      userService.getBalance(userId),
      transactionService.getTransactionsByUserId(userId),
    ]);
    res.render('client/transactions', {
      title: 'Mes transactions',
      client: req.clientUser,
      balance: balanceData.balance,
      name: balanceData.name,
      transactions: allTransactions,
      layout: 'layouts/client',
    });
  } catch (error) {
    res.redirect('/client/dashboard');
  }
};

const logout = (req, res) => {
  res.clearCookie('clientToken');
  res.redirect('/client/login');
};

module.exports = {
  loginForm,
  loginAction,
  dashboard,
  depositForm,
  depositAction,
  withdrawForm,
  withdrawAction,
  transactions,
  logout,
};
