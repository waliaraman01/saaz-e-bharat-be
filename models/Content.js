const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    section: {
        type: String,
        required: true,
        index: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, { timestamps: true });

module.exports = mongoose.model('Content', contentSchema);
