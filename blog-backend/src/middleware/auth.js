const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/auth');

const JWT_SECRET = getJwtSecret();

function requireAuth(req, res, next) {
    if (!JWT_SECRET) {
        return res.status(500).json({ error: '\u670d\u52a1\u5668\u9274\u6743\u914d\u7f6e\u7f3a\u5931' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '\u672a\u767b\u5f55\uff0c\u8bf7\u5148\u767b\u5f55\u7ba1\u7406\u540e\u53f0' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.adminUser = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: '\u767b\u5f55\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55' });
    }
}

module.exports = { requireAuth, JWT_SECRET };
