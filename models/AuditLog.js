const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false,
        index: true
    },
    action: {
        type: String,
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId
    },
    targetModel: {
        type: String
    },
    details: {
        type: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
