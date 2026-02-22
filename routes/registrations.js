const express = require('express');
const router = express.Router();
const {
    register,
    getRegistrations,
    approveRegistration,
    rejectRegistration,
    verifyOtp,
    getAnalytics,
    batchApprove,
    batchReject,
    deleteRegistration
} = require('../controllers/registrationController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Debug check
router.use((req, res, next) => {
    if (req.method === 'DELETE') {
        console.log(`[ROUTER_DEBUG] DELETE request detected for: ${req.url}`);
    }
    next();
});

// Public
router.post('/', upload.single('document'), register);
router.post('/verify-otp', verifyOtp);

// Admin only
router.get('/', protect, authorize('admin', 'super_admin'), getRegistrations);
router.get('/analytics', protect, authorize('admin', 'super_admin'), getAnalytics);
router.get('/export', protect, authorize('admin', 'super_admin'), (req, res) => {
    const { exportRegistrations } = require('../controllers/registrationController');
    return exportRegistrations(req, res);
});

router.post('/batch-approve', protect, authorize('admin', 'super_admin'), batchApprove);
router.post('/batch-reject', protect, authorize('admin', 'super_admin'), batchReject);

// Individual operations
router.delete('/:id', protect, authorize('super_admin'), deleteRegistration);
router.post('/:id/approve', protect, authorize('admin', 'super_admin'), approveRegistration);
router.post('/:id/reject', protect, authorize('admin', 'super_admin'), rejectRegistration);

// Catch-all FOR THIS ROUTER ONLY
router.use((req, res) => {
    console.log(`[REG-ROUTER-404] No match for ${req.method} ${req.url}`);
    res.status(404).json({ message: `Registrations sub-route ${req.method} ${req.url} not found` });
});

module.exports = router;
