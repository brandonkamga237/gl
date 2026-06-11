const router = require('express').Router();
const { requireAdmin } = require('../middlewares/authMiddleware');
const c = require('../controllers/adminController');

router.get('/', (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', requireAdmin, c.dashboard);
router.get('/clients', requireAdmin, c.clients);
router.post('/clients/:id/toggle', requireAdmin, c.toggleActive);

module.exports = router;
