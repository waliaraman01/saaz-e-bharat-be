const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['Visitor', 'Artist', 'Stall Exhibitor', 'Food Vendor', 'Media', 'Volunteer', 'Sponsor'],
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
    fullName: {
        type: String,
        required: true
    },
    organization: String, // Organization / Group Name

    isEmailVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending_verification', 'pending_review', 'approved', 'rejected'],
        default: 'pending_verification',
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
    checkInTime: Date,

    // Category specific fields (Flat collection with category object strategy as per user request)

    // Visitor
    attendanceDay: String,
    interests: [String],
    referralSource: String,

    // Artist
    artForm: String,
    performanceType: { type: String, enum: ['Solo', 'Group'] },
    groupSize: Number,
    portfolioUrl: String, // Previous Performance Link
    performanceDescription: String,
    expectedHonorarium: Number,

    // Sponsor
    companyName: String,
    industry: String,
    department: String,
    interestedAs: String,
    reasonForJoining: String,

    // Stall Exhibitor
    typeOfStall: String,
    productsToDisplay: String,

    // Food Vendor
    stateCuisine: String,
    foodItems: String,

    // Media
    mediaHouseName: String,
    mediaType: String,

    // Volunteer
    availability: [String], // Array for checkbox selection
    preferredRole: String,

    documentUrl: String,

    // Verification fields
    verificationOtp: String,
    otpExpires: Date,
    rejectionReason: String,

}, { timestamps: true });

// Indexes for performance
registrationSchema.index({ category: 1, status: 1 });
registrationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);
