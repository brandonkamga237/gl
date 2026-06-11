const userService = require('../services/userService');
const transactionService = require('../services/transactionService');

const dashboard = async (req, res) => {
  try {
    const [profile, history] = await Promise.all([
      userService.getProfile(req.user.id),
      transactionService.getHistory(req.user.id),
    ]);
    res.render('app/dashboard', {
      title: 'Accueil',
      profile,
      balance: parseFloat(profile.balance),
      recentTx: history.slice(0, 4),
      layout: 'layouts/app',
    });
  } catch { res.redirect('/login'); }
};

const depositPage = async (req, res) => {
  const profile = await userService.getProfile(req.user.id).catch(() => null);
  res.render('app/deposit', {
    title: 'Dépôt', layout: 'layouts/app',
    balance: profile ? parseFloat(profile.balance) : 0,
    profile,
    success: req.query.success || null, error: req.query.error || null,
  });
};

const depositAction = async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const description = (req.body.description || '').trim();
    if (!amount || amount < 100) return res.redirect('/app/deposit?error=' + encodeURIComponent('Montant minimum : 100 FCFA'));
    await transactionService.deposit(req.user.id, amount, description);
    res.redirect('/app/deposit?success=' + encodeURIComponent(amount.toLocaleString('fr-FR') + ' FCFA déposés avec succès'));
  } catch { res.redirect('/app/deposit?error=Erreur lors du dépôt'); }
};

const withdrawPage = async (req, res) => {
  const profile = await userService.getProfile(req.user.id).catch(() => null);
  res.render('app/withdraw', {
    title: 'Retrait', layout: 'layouts/app',
    balance: profile ? parseFloat(profile.balance) : 0,
    success: req.query.success || null, error: req.query.error || null,
  });
};

const withdrawAction = async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const description = (req.body.description || '').trim();
    if (!amount || amount <= 0) return res.redirect('/app/withdraw?error=Montant invalide');
    await transactionService.withdraw(req.user.id, amount, description);
    res.redirect('/app/withdraw?success=' + encodeURIComponent(amount.toLocaleString('fr-FR') + ' FCFA retirés avec succès'));
  } catch (e) {
    const msg = e.message === 'INSUFFICIENT_FUNDS' ? 'Solde insuffisant' : 'Erreur lors du retrait';
    res.redirect('/app/withdraw?error=' + encodeURIComponent(msg));
  }
};

const transferPage = async (req, res) => {
  const profile = await userService.getProfile(req.user.id).catch(() => null);
  res.render('app/transfer', {
    title: 'Virement', layout: 'layouts/app',
    balance: profile ? parseFloat(profile.balance) : 0,
    profile,
    success: req.query.success || null, error: req.query.error || null,
  });
};

const transferAction = async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const { to, description } = req.body;
    if (!to) return res.redirect('/app/transfer?error=Destinataire requis');
    if (!amount || amount < 1) return res.redirect('/app/transfer?error=Montant invalide');
    const result = await transactionService.transfer(req.user.id, to, amount, description);
    const msg = `${amount.toLocaleString('fr-FR')} FCFA envoyés à ${result.recipient.name}`;
    res.redirect('/app/transfer?success=' + encodeURIComponent(msg));
  } catch (e) {
    const errors = {
      INSUFFICIENT_FUNDS: 'Solde insuffisant pour ce virement',
      RECIPIENT_NOT_FOUND: 'Destinataire introuvable — vérifiez le numéro ou l\'email',
      SELF_TRANSFER: 'Vous ne pouvez pas vous virer de l\'argent à vous-même',
      RECIPIENT_REQUIRED: 'Veuillez saisir le destinataire',
    };
    res.redirect('/app/transfer?error=' + encodeURIComponent(errors[e.message] || 'Erreur lors du virement'));
  }
};

const historyPage = async (req, res) => {
  try {
    const [profile, txList] = await Promise.all([
      userService.getProfile(req.user.id),
      transactionService.getHistory(req.user.id),
    ]);
    res.render('app/history', {
      title: 'Historique', layout: 'layouts/app',
      transactions: txList,
      balance: parseFloat(profile.balance),
    });
  } catch { res.redirect('/app/dashboard'); }
};

module.exports = { dashboard, depositPage, depositAction, withdrawPage, withdrawAction, transferPage, transferAction, historyPage };
