/**
 * Auth Middleware — verifies JWT token on protected routes
 */
const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: '未授权，请先登录管理台' });
    }

    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token 无效或已过期，请重新登录' });
    }
};
