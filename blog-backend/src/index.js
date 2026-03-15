require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { getMissingAuthConfig } = require('./config/auth');
const { initDb } = require('./database');
const articleRoutes = require('./routes/articles');
const uploadRoutes = require('./routes/upload');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');
const cdkRoutes = require('./routes/cdk');

const app = express();
app.set('trust proxy', 1); // Enable trusting reverse proxy IP

const PORT = process.env.PORT || 3001;
const missingAuthConfig = getMissingAuthConfig();

if (missingAuthConfig.length > 0) {
    console.warn(`Admin auth is not fully configured: ${missingAuthConfig.join(', ')}`);
}

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

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
        if (/^https:\/\/(tech|api)\./.test(origin)) return callback(null, true);
        callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5' }
});
app.use('/api', apiLimiter);

// Stricter rate limit for login (10 attempts per 15 min)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: '登录尝试过多，请15分钟后再试' }
});

// Removed global cdkLimiter because individual routes in cdk.js have distinct limiters

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/articles', articleRoutes);  // auth applied inside route file
app.use('/api/upload', uploadRoutes);     // auth applied inside route file
app.use('/api', settingsRoutes);          // auth applied inside route file
app.use('/api/cdk', cdkRoutes);                 // CDK 校验 + TOTP（路由内部有独立限流）

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: '\u670d\u52a1\u5668\u5185\u90e8\u9519\u8bef' });
});

initDb()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend running at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error(`Failed to initialize database: ${err.message}`);
        process.exit(1);
    });
