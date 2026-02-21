const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = await Admin.findById(decoded.id).select('-password');
        if (!req.admin) {
            return res.status(401).json({ message: 'User not found or deleted' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token failed' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({ message: 'User role not authorized' });
        }
        next();
    };
};

module.exports = { protect, authorize };
