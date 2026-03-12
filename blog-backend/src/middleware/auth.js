/**
 * Auth Middleware — JWT Token Verification
 * 
 * Protects admin routes (POST, PUT, DELETE) by requiring a valid JWT token
 * in the Authorization header: "Bearer <token>"
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'blog-admin-secret-key-change-in-production';

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录，请先登录管理后台' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.adminUser = decoded; // attach user info to request
        next();
    } catch (err) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

module.exports = { requireAuth, JWT_SECRET };
