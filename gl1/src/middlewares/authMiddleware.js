const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  });
};

const requireAdminCookie = (req, res, next) => {
  const token = req.cookies && req.cookies.adminToken;

  if (!token) {
    return res.redirect('/admin/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    if (decoded.role !== 'admin') {
      return res.redirect('/admin/login');
    }
    req.adminUser = decoded;
    next();
  } catch (error) {
    return res.redirect('/admin/login');
  }
};

const requireClientCookie = (req, res, next) => {
  const token = req.cookies && req.cookies.clientToken;
  if (!token) {
    return res.redirect('/client/login');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.clientUser = decoded;
    next();
  } catch (error) {
    return res.redirect('/client/login');
  }
};

module.exports = { verifyToken, requireAdmin, requireAdminCookie, requireClientCookie };
