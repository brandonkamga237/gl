const router = require('express').Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const c = require('../controllers/appController');

router.use(requireAuth);

router.get('/', (req, res) => res.redirect('/app/dashboard'));
router.get('/dashboard', c.dashboard);
router.get('/deposit', c.depositPage);
router.post('/deposit', c.depositAction);
router.get('/withdraw', c.withdrawPage);
router.post('/withdraw', c.withdrawAction);
router.get('/transfer', c.transferPage);
router.post('/transfer', c.transferAction);
router.get('/history', c.historyPage);

module.exports = router;
