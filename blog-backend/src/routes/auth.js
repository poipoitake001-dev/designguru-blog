/**
 * Auth Routes
 *
 * POST /api/auth/login   — verify admin password, return JWT
 * GET  /api/auth/verify  — check if token is still valid
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: '请输入密码' });
        }

        const hash = process.env.ADMIN_PASSWORD_HASH;
        if (!hash) {
            console.error('ADMIN_PASSWORD_HASH not set in environment');
            return res.status(500).json({ error: '服务器配置错误' });
        }

        const valid = await bcrypt.compare(password, hash);
        if (!valid) {
            return res.status(401).json({ error: '密码错误' });
        }

        const token = jwt.sign(
            { role: 'admin' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ success: true, token });
    } catch (err) {
        console.error('POST /api/auth/login error:', err);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

router.get('/verify', (req, res) => {
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
