const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser léger
app.use((req, res, next) => {
  req.cookies = {};
  const h = req.headers.cookie;
  if (h) h.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    req.cookies[k.trim()] = v.join('=').trim();
  });
  next();
});

app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(expressLayouts);
app.set('layout', 'layouts/app');

// Routes
app.use('/', require('./routes/authRoutes'));
app.use('/app', require('./routes/appRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// 404
app.use((req, res) => res.status(404).render('error', { layout: false, code: 404, message: 'Page introuvable' }));

// Erreur serveur
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { layout: false, code: 500, message: 'Erreur interne' });
});

module.exports = app;
