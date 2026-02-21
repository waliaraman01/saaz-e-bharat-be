const express = require('express');
const router = express.Router();
const { login, verifyOTP, createAdmin, getAdmins, deleteAdmin } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', login);
router.post('/verify-otp', verifyOTP);

// Super Admin only
router.use(protect, authorize('super_admin'));
router.post('/create', createAdmin);
router.get('/', getAdmins);
router.delete('/:id', deleteAdmin);

module.exports = router;
