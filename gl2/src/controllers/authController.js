const userService = require('../services/userService');

const loginPage = (req, res) => {
  res.render('auth/login', { layout: false, error: req.query.error || null, mode: 'login' });
};

const registerPage = (req, res) => {
  res.render('auth/login', { layout: false, error: req.query.error || null, mode: 'register' });
};

const loginAction = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.redirect('/login?error=Champs requis');
    const result = await userService.login(email, password);
    const dest = result.user.role === 'admin' ? '/admin/dashboard' : '/app/dashboard';
    res.cookie('token', result.token, { httpOnly: true, maxAge: 86400000 });
    res.redirect(dest);
  } catch (e) {
    const msg = e.message === 'INVALID_CREDENTIALS' ? 'Email ou mot de passe incorrect'
      : e.message === 'ACCOUNT_DISABLED' ? 'Compte suspendu — contactez votre agence'
      : 'Une erreur est survenue';
    res.redirect('/login?error=' + encodeURIComponent(msg));
  }
};

const registerAction = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.redirect('/register?error=Champs requis');
    if (password.length < 6) return res.redirect('/register?error=Mot de passe trop court (6 caractères minimum)');
    await userService.register({ name, email, password, phone });
    res.redirect('/login?success=Compte créé ! Connectez-vous.');
  } catch (e) {
    const msg = e.message === 'EMAIL_ALREADY_EXISTS' ? 'Cet email est déjà utilisé' : 'Erreur lors de l\'inscription';
    res.redirect('/register?error=' + encodeURIComponent(msg));
  }
};

const logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
};

module.exports = { loginPage, registerPage, loginAction, registerAction, logout };
