const express = require('express');
const router = express.Router();
const { getContent, updateContent, uploadMedia } = require('../controllers/contentController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getContent);
router.post('/batch', protect, authorize('admin', 'super_admin'), updateContent);
router.post('/media', protect, authorize('admin', 'super_admin'), upload.single('media'), uploadMedia);

module.exports = router;
