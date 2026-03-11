/**
 * Upload Routes
 * Handles file uploads for images and videos from WangEditor.
 * Files are stored in Cloudinary for persistent global access.
 *
 * POST /api/upload  - Upload a single file, returns the public URL
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer storage to use Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'designguru-blog', // folder name in your Cloudinary account
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'ogg'],
        // transformation: [{ width: 1200, crop: 'limit' }] // Optional: auto resize large images
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB max
    }
});

// ---------------------------------------------------------------------------
// POST /api/upload — upload a single media file to Cloudinary
// ---------------------------------------------------------------------------
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有收到文件' });
        }

        // req.file contains the cloudinary URL in its 'path' property
        const fileUrl = req.file.path;

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
