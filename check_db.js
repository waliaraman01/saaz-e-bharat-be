require('dotenv').config();
const mongoose = require('mongoose');
const Content = require('./models/Content');

const checkContent = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const emailSettings = await Content.find({ section: 'email_template' });
        console.log('Email Settings in DB:');
        emailSettings.forEach(s => {
            console.log(`Key: ${s.key}`);
            console.log(`Value: ${s.value}`);
            console.log('---');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkContent();
