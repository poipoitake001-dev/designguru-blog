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
const { requireAuth } = require('../middleware/auth');

// Configure Cloudinary from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Validate Cloudinary credentials on startup
(async () => {
    try {
        await cloudinary.api.ping();
        console.log('✅ Cloudinary credentials OK');
    } catch (e) {
        console.error('❌ Cloudinary credentials INVALID:', e.message || e.error?.message);
        console.error('   Please update CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in your .env');
    }
})();

// Use in-memory multer (upload buffer, then push to Cloudinary ourselves)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB max
    }
});

// Helper: derive format from mimetype
function guessFormat(mimetype) {
    const map = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/svg+xml': 'svg',
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogg',
    };
    return map[mimetype] || undefined;
}

// Upload buffer to Cloudinary via upload_stream
function uploadToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
        stream.end(buffer);
    });
}

// ---------------------------------------------------------------------------
// POST /api/upload — upload a single media file to Cloudinary (JWT protected)
// ---------------------------------------------------------------------------
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有收到文件' });
        }

        const file = req.file;
        const isVideo = file.mimetype.startsWith('video/');

        // Build Cloudinary upload options
        const uploadOptions = {
            folder: 'designguru-blog',
            resource_type: isVideo ? 'video' : 'image',
            unique_filename: true,
        };

        // If file has no usable extension, set format explicitly
        const hasExtension = file.originalname && file.originalname.includes('.');
        if (!hasExtension) {
            const fmt = guessFormat(file.mimetype);
            if (fmt) uploadOptions.format = fmt;
        }

        const result = await uploadToCloudinary(file.buffer, uploadOptions);

        // WangEditor expects { url, alt } for images
        res.json({
            url: result.secure_url,
            alt: file.originalname || 'uploaded-image',
            href: result.secure_url
        });
    } catch (err) {
        console.error('POST /api/upload Cloudinary error:', {
            message: err.message,
            http_code: err.http_code,
            error: err.error,
        });

        const detail = err.message || (err.error && err.error.message) || '上传出错';
        const status = err.http_code || 500;
        res.status(status).json({ error: detail });
    }
});

// Multer error handling middleware
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err.code, err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: '文件大小超过50MB限制' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        console.error('Upload middleware error:', err.message);
        return res.status(500).json({ error: err.message || '上传出错' });
    }
    next();
});

module.exports = router;
