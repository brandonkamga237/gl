const jwt = require('jsonwebtoken');
const SECRET = () => process.env.JWT_SECRET || 'fallback_secret';

const requireAuth = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, SECRET());
    next();
  } catch {
    res.clearCookie('token');
    res.redirect('/login');
  }
};

const requireAdmin = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, SECRET());
    if (decoded.role !== 'admin') return res.redirect('/app/dashboard');
    req.user = decoded;
    next();
  } catch {
    res.redirect('/login');
  }
};

const requireApiAuth = (req, res, next) => {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token requis' });
  try {
    req.user = jwt.verify(token, SECRET());
    next();
  } catch {
    res.status(403).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

module.exports = { requireAuth, requireAdmin, requireApiAuth };
