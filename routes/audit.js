const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await AuditLog.find()
            .populate('adminId', 'username email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
