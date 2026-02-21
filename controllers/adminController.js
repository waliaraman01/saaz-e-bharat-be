const Admin = require('../models/Admin');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { logAction } = require('../utils/logger');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const admin = await Admin.findOne({ email }).select('+otpSecret');
        if (admin && (await admin.comparePassword(password, admin.password))) {
            // Ensure username exists (fallback for legacy accounts)
            if (!admin.username) {
                admin.username = admin.email.split('@')[0];
            }

            // Check if admin has OTP set up
            if (!admin.otpSecret) {
                // First time login - generate OTP secret
                const secret = speakeasy.generateSecret({ name: `Saaz-e-Bharat (${email})` });
                admin.otpSecret = secret.base32;
                await admin.save();

                const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
                return res.json({
                    status: 'otp_setup_required',
                    userId: admin._id,
                    qrCode: qrCodeUrl,
                    secret: secret.base32,
                    message: 'Please scan this QR code with your authenticator app (e.g. Google Authenticator)'
                });
            }

            // If already set up, request OTP
            return res.json({ status: 'otp_required', userId: admin._id });
        }
        await logAction(req, 'FAILED_LOGIN', null, 'Admin', { email });
        res.status(401).json({ message: 'Invalid credentials' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.verifyOTP = async (req, res) => {
    const { userId, token } = req.body;
    try {
        const tokenStr = String(token || '');
        if (!userId || !tokenStr) {
            return res.status(400).json({ message: 'UserId and token are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format' });
        }

        const admin = await Admin.findById(userId).select('+otpSecret');
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        if (!admin.username) {
            admin.username = admin.email.split('@')[0];
        }

        if (!admin.otpSecret) return res.status(400).json({ message: 'MFA not set up' });

        const verified = speakeasy.totp.verify({
            secret: admin.otpSecret,
            encoding: 'base32',
            token: tokenStr,
            window: 2 // Allow ±60s drift
        });

        if (verified) {
            if (!process.env.JWT_SECRET) {
                console.error('[CRITICAL] JWT_SECRET missing');
                throw new Error('JWT_SECRET not configured');
            }

            const jwtToken = jwt.sign(
                { id: admin._id.toString(), role: admin.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            await Admin.updateOne(
                { _id: admin._id },
                { $set: { lastLogin: new Date(), username: admin.username } }
            );

            req.admin = admin;
            await logAction(req, 'ADMIN_LOGIN', admin._id, 'Admin');

            return res.json({
                token: jwtToken,
                admin: {
                    id: admin._id.toString(),
                    username: admin.username,
                    email: admin.email,
                    role: admin.role
                }
            });
        } else {
            await logAction(req, 'FAILED_OTP', admin._id, 'Admin', { email: admin.email });
            return res.status(401).json({ message: 'Invalid OTP' });
        }
    } catch (error) {
        console.error('[AUTH PROB] Trace:', error);
        return res.status(500).json({
            message: 'Internal server error during verification',
            error: error.message
        });
    }
};

exports.createAdmin = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const admin = new Admin({ username, email, password, role });
        await admin.save();
        await logAction(req, 'CREATE_ADMIN', admin._id, 'Admin', { email, role });
        res.status(201).json({ message: 'Admin created successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getAdmins = async (req, res) => {
    try {
        const admins = await Admin.find().select('-otpSecret').lean();

        // Ensure all admins have a username for display
        const processedAdmins = admins.map(admin => ({
            ...admin,
            username: admin.username || admin.email.split('@')[0]
        }));

        res.json(processedAdmins);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (req.admin.id === id) {
            return res.status(400).json({ message: 'You cannot delete your own administrative account' });
        }

        const admin = await Admin.findById(id);

        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        if (admin.role === 'super_admin' && (await Admin.countDocuments({ role: 'super_admin' })) === 1) {
            return res.status(400).json({ message: 'Cannot delete the last super admin' });
        }

        await Admin.findByIdAndDelete(id);
        await logAction(req, 'DELETE_ADMIN', id, 'Admin', { email: admin.email });

        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
