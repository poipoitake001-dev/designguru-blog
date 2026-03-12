/**
 * Blog Backend — Main Entry Point
 * Deployed on Render, Database on Neon (PostgreSQL)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDb } = require('./database');
const articleRoutes = require('./routes/articles');
const uploadRoutes = require('./routes/upload');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Security — Helmet
// ---------------------------------------------------------------------------
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ---------------------------------------------------------------------------
// CORS — allow frontend domains (Vercel + local dev + custom domains)
// ---------------------------------------------------------------------------
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);
        if (/^https:\/\/([a-z0-9-]+\.)?super-card-shop\.cyou$/.test(origin)) return callback(null, true);
        callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api', apiLimiter);

// Stricter rate limit for login (10 attempts per 15 min)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: '登录尝试过多，请15分钟后再试' }
});

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Static file serving for uploads (legacy)
// ---------------------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/articles', articleRoutes);  // auth applied inside route file
app.use('/api/upload', uploadRoutes);     // auth applied inside route file
app.use('/api', settingsRoutes);          // auth applied inside route file

// Health check (used by Render / UptimeRobot)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
});

// ---------------------------------------------------------------------------
// Start Server — initialize DB first
// ---------------------------------------------------------------------------
initDb()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n  🚀 Blog Backend running at http://localhost:${PORT}`);
            console.log(`  📡 API: http://localhost:${PORT}/api/articles`);
            console.log(`  🔒 Auth: http://localhost:${PORT}/api/auth/login\n`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to initialize database:', err.message);
        process.exit(1);
    });
