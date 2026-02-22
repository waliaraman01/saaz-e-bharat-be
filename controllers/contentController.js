const Content = require('../models/Content');
const { logAction } = require('../utils/logger');

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
            return res.status(400).json({ message: 'Field key is required' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        await Content.findOneAndUpdate(
            { key },
            {
                value: fileUrl,
                section: section || 'media',
                updatedBy: req.admin?._id
            },
            { upsert: true }
        );

        await logAction(req, 'UPLOAD_MEDIA', null, 'Content', { key, url: fileUrl });
        res.json({ message: 'Media uploaded successfully', url: fileUrl });
    } catch (error) {
        console.error('Upload Controller Error:', error);
        res.status(500).json({ message: error.message });
    }
};
