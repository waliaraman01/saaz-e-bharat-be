const express = require('express');
const router = express.Router();
const { register, getRegistrations, approveRegistration, rejectRegistration, verifyOtp, getAnalytics, batchApprove, batchReject } = require('../controllers/registrationController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public
router.post('/', upload.single('document'), register);
router.post('/verify-otp', verifyOtp);

// Admin only
router.get('/', protect, authorize('admin', 'super_admin'), getRegistrations);
router.get('/analytics', protect, authorize('admin', 'super_admin'), getAnalytics);
router.get('/export', protect, authorize('admin', 'super_admin'), (req, res, next) => {
    // We'll import it in the controller and link it here
    const { exportRegistrations } = require('../controllers/registrationController');
    return exportRegistrations(req, res);
});
router.post('/batch-approve', protect, authorize('admin', 'super_admin'), batchApprove);
router.post('/batch-reject', protect, authorize('admin', 'super_admin'), batchReject);
router.post('/:id/approve', protect, authorize('admin', 'super_admin'), approveRegistration);
router.post('/:id/reject', protect, authorize('admin', 'super_admin'), rejectRegistration);

module.exports = router;
