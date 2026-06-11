const router = require('express').Router();
const c = require('../controllers/authController');

router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', c.loginPage);
router.post('/login', c.loginAction);
router.get('/register', c.registerPage);
router.post('/register', c.registerAction);
router.get('/logout', c.logout);

module.exports = router;
