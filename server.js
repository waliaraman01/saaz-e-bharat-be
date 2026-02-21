require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, 'uploads')));

// Request Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Route Imports
const registrationRoutes = require('./routes/registrations');
const adminRoutes = require('./routes/admins');
const contentRoutes = require('./routes/content');
const auditRoutes = require('./routes/audit');

// API Routes
app.use('/api/registrations', registrationRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.stack}`);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 Handler for undefined routes
app.use((req, res) => {
    console.log(`[404 NOT FOUND] ${req.method} ${req.url}`);
    res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

// Database connection
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

