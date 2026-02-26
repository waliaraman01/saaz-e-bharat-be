require('dotenv').config();
const mongoose = require('mongoose');
const Content = require('./models/Content');

const searchAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const results = await Content.find({ value: { $regex: /Mandapam/i } });
        console.log('Search Results:', results);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

searchAll();
