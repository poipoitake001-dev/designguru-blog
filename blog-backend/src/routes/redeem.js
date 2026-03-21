/**
 * Redeem Routes — 第三方发卡网 API 代理
 *
 * GET  /api/redeem/validate?code=xxx  — 验证兑换码是否有效
 * POST /api/redeem/submit             — 执行兑换（消耗卡密）
 *
 * 第三方 API 基础地址: https://yyl.ncet.top/shop/shop
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const rateLimit = require('express-rate-limit');

const THIRD_PARTY_BASE = 'https://yyl.ncet.top/shop/shop';

// 限流：防止滥用
const redeemLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: { error: '请求过于频繁，请5分钟后再试' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数：发送 HTTP/HTTPS 请求
// ─────────────────────────────────────────────────────────────────────────────
function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : require('http');

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {}),
            },
        };

        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: { raw: data } });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy(new Error('请求超时'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/redeem/validate?code=XXX — 验证兑换码
// ─────────────────────────────────────────────────────────────────────────────
router.get('/validate', redeemLimiter, async (req, res) => {
    try {
        const { code } = req.query;
        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ error: '请输入兑换码' });
        }

        const url = `${THIRD_PARTY_BASE}/redeem/validate?code=${encodeURIComponent(code.trim())}`;
        const result = await fetchJson(url);

        if (result.status !== 200) {
            const errMsg = result.body?.message || result.body?.error || '兑换码验证失败';
            return res.status(result.status).json({ error: errMsg });
        }

        res.json(result.body);
    } catch (err) {
        console.error('GET /api/redeem/validate error:', err.message);
        res.status(500).json({ error: '验证请求失败，请稍后重试' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/redeem/submit — 执行兑换
// ─────────────────────────────────────────────────────────────────────────────
router.post('/submit', redeemLimiter, async (req, res) => {
    try {
        const { code, contactEmail, quantity = 1 } = req.body;

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ error: '请提供兑换码' });
        }
        if (!contactEmail || typeof contactEmail !== 'string' || !contactEmail.trim()) {
            return res.status(400).json({ error: '请提供联系邮箱' });
        }

        const payload = JSON.stringify({
            code: code.trim(),
            contactEmail: contactEmail.trim(),
            quantity: Number(quantity) || 1,
        });

        const result = await fetchJson(`${THIRD_PARTY_BASE}/redeem`, {
            method: 'POST',
            body: payload,
        });

        if (result.status !== 200) {
            const errMsg = result.body?.message || result.body?.error || '兑换失败';
            return res.status(result.status).json({ error: errMsg });
        }

        res.json(result.body);
    } catch (err) {
        console.error('POST /api/redeem/submit error:', err.message);
        res.status(500).json({ error: '兑换请求失败，请稍后重试' });
    }
});

module.exports = router;
