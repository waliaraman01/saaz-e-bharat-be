const Content = require('../models/Content');
const { logAction } = require('../utils/logger');
const fs = require('fs');

exports.getContent = async (req, res) => {
    try {
        // Only select fields needed for display to prevent leaking sensitive admin metadata
        const content = await Content.find({}, 'key value section -_id');
        res.json(content);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateContent = async (req, res) => {
    const { entries } = req.body; // Array of { key, value, section }
    try {
        for (let entry of entries) {
            await Content.findOneAndUpdate(
                { key: entry.key },
                { ...entry, updatedBy: req.admin._id },
                { upsert: true }
            );
        }
        await logAction(req, 'UPDATE_TEXT_CONTENT', null, 'Content', { count: entries.length });
        res.json({ message: 'Content updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const { key, section } = req.body;

        if (!key) {
            if (req.file.path) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Field key is required' });
        }

        // Read file and convert to Base64 for database storage
        const fileBuffer = fs.readFileSync(req.file.path);
        const base64Data = fileBuffer.toString('base64');
        const mimeType = req.file.mimetype;
        const base64String = `data:${mimeType};base64,${base64Data}`;

        await Content.findOneAndUpdate(
            { key },
            {
                value: base64String,
                section: section || 'media',
                updatedBy: req.admin?._id
            },
            { upsert: true }
        );

        // Delete the temporary file from disk
        fs.unlinkSync(req.file.path);

        await logAction(req, 'UPLOAD_MEDIA', null, 'Content', { key, info: 'Stored in MongoDB as Base64' });
        res.json({ message: 'Media uploaded successfully to database', url: base64String });
    } catch (error) {
        console.error('Upload Controller Error:', error);
        if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (e) { }
        res.status(500).json({ message: error.message });
    }
};
