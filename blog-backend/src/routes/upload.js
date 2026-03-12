/**
 * Upload Routes
 * Handles file uploads for images and videos from WangEditor.
 * Files are stored in Cloudinary for persistent global access.
 *
 * POST /api/upload  - Upload a single file (requires admin JWT), returns the public URL
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { requireAuth } = require('../middleware/auth');

// Configure Cloudinary from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer storage to use Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Determine resource type based on mimetype
        const isVideo = file.mimetype.startsWith('video/');
        return {
            folder: 'designguru-blog',
            resource_type: isVideo ? 'video' : 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'ogg'],
        };
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB max
    }
});

// ---------------------------------------------------------------------------
// POST /api/upload — upload a single media file to Cloudinary (JWT protected)
// ---------------------------------------------------------------------------
router.post('/', requireAuth, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有收到文件' });
        }

        // req.file.path contains the Cloudinary URL
        const fileUrl = req.file.path;

        // WangEditor expects { url, alt } for images
        res.json({
            url: fileUrl,
            alt: req.file.originalname || 'uploaded-image',
            href: fileUrl
        });
    } catch (err) {
        console.error('POST /api/upload error:', err);
        res.status(500).json({ error: '文件上传失败' });
    }
});

// Multer / Cloudinary error handling middleware
router.use((err, req, res, next) => {
    // Log full error object so Cloudinary errors are visible in server logs
    console.error('Upload middleware error:', JSON.stringify({
        message: err.message,
        http_code: err.http_code,
        code: err.code,
        error: err.error,
        stack: err.stack
    }, null, 2));

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: '文件大小超过50MB限制' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        // Return Cloudinary-specific error info when available
        const errMsg = err.message || (err.error && err.error.message) || '上传出错';
        return res.status(400).json({ error: errMsg });
    }
    next();
});

module.exports = router;
