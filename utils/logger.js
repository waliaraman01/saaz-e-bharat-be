const AuditLog = require('../models/AuditLog');

const logAction = async (req, action, targetId, targetModel, details) => {
    try {
        const log = new AuditLog({
            adminId: req.admin ? req.admin._id : null,
            action,
            targetId,
            targetModel,
            details,
            ipAddress: req.ip || req.connection.remoteAddress
        });
        await log.save();
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
};

module.exports = { logAction };
