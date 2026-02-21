const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['Visitor', 'Artist', 'StallExhibitor', 'FoodVendor', 'Media', 'Volunteer', 'Sponsor'],
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    qrId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    isCheckedIn: {
        type: Boolean,
        default: false
    },
    checkInTime: {
        type: Date
    },

    // Category specific fields
    fullName: String,
    city: String,
    idType: String,

    artistName: String,
    artForm: String,
    state: String,
    portfolioUrl: String,

    businessName: String,
    stallCategory: String,
    gstNumber: String,

    brandName: String,
    cuisineType: String,
    fssaiNumber: String,

    organization: String,
    mediaType: String,
    pressIdUrl: String,

    preferredRole: String,
    availability: String,

    companyName: String,
    sponsorshipTier: String,
    documentUrl: String,

    // Verification fields
    verificationOtp: String,
    otpExpires: Date,
    rejectionReason: String,

}, { timestamps: true });

// Indexes mentioned in the spec
registrationSchema.index({ category: 1, status: 1 });
registrationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);
