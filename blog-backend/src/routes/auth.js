const express = require('express');
const jwt = require('jsonwebtoken');
const { getMissingAuthConfig, verifyAdminPassword } = require('../config/auth');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5bc6\u7801' });
        }

        const missingAuthConfig = getMissingAuthConfig();
        if (missingAuthConfig.length > 0) {
            console.error(`Admin auth config missing: ${missingAuthConfig.join(', ')}`);
            return res.status(500).json({ error: '\u7ba1\u7406\u5458\u767b\u5f55\u914d\u7f6e\u672a\u5b8c\u6210' });
        }

        const valid = await verifyAdminPassword(password);
        if (!valid) {
            return res.status(401).json({ error: '\u5bc6\u7801\u9519\u8bef' });
        }

        const token = jwt.sign(
            { role: 'admin' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ success: true, token });
    } catch (err) {
        console.error('POST /api/auth/login error:', err);
        res.status(500).json({ error: '\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5' });
    }
});

router.get('/verify', (req, res) => {
    if (!JWT_SECRET) {
        return res.status(500).json({ valid: false, error: '\u670d\u52a1\u5668\u9274\u6743\u914d\u7f6e\u7f3a\u5931' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ valid: false });
    }

    try {
        jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        res.json({ valid: true });
    } catch (err) {
        res.status(401).json({ valid: false });
    }
});

module.exports = router;
