const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (inline)
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      req.cookies[name.trim()] = rest.join('=').trim();
    });
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));

// Admin EJS Routes
app.use('/admin', require('./routes/adminRoutes'));

// Client portal
app.use('/client', require('./routes/clientRoutes'));

// Root redirect
app.get('/', (req, res) => res.redirect('/client/login'));

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  res.status(404).render('error', { message: 'Page non trouvée', layout: false });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
  res.status(500).render('error', { message: 'Erreur interne du serveur', layout: false });
});

module.exports = app;
