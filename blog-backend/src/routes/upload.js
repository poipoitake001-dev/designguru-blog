/**
 * Upload Routes
 * Handles file uploads for images and videos from WangEditor.
 * Files are stored locally in the /uploads directory.
 *
 * POST /api/upload  - Upload a single file, returns the public URL
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Configure Multer storage: save to /uploads with unique filenames
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        // Generate a unique filename to avoid collisions
        const ext = path.extname(file.originalname);
        const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        cb(null, uniqueName);
    }
});

// File filter: allow common image and video formats only
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg'
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB max
    }
});

// ---------------------------------------------------------------------------
// POST /api/upload — upload a single media file
// ---------------------------------------------------------------------------
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有收到文件' });
        }

        // Build the public URL based on the server's static file serving
        const fileUrl = `/uploads/${req.file.filename}`;

        // WangEditor expects { url, alt } for images
        res.json({
            url: fileUrl,
            alt: req.file.originalname,
            href: fileUrl  // optional: used for link insertion
        });
    } catch (err) {
        console.error('POST /api/upload error:', err);
        res.status(500).json({ error: '文件上传失败' });
    }
});

// Multer error handling middleware
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: '文件大小超过50MB限制' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

module.exports = router;
