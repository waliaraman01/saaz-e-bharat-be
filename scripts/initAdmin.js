require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const initAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const email = 'superadmin@saazebharat.com';
        const password = 'ChangeMe123!';

        let admin = await Admin.findOne({ email });
        if (!admin) {
            admin = new Admin({ email, role: 'super_admin' });
        }

        admin.username = 'System Admin';
        admin.password = password; // This will trigger pre-save hook

        await admin.save();

        console.log('Super Admin initialized/updated');
        console.log('Email:', email);
        console.log('Default Password:', password);
        console.log('Account is ready for login.');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing admin:', error.message);
        process.exit(1);
    }
};

initAdmin();
