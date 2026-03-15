/**
 * CDK Routes — 凭证校验 + 本地 TOTP 生成 + 管理
 *
 * POST /api/cdk/verify  — 公开接口，校验 CDK 并返回 TOTP + 教程 + 客服 ID
 * POST /api/cdk/create  — 管理员接口（需 JWT），创建新 CDK
 * GET  /api/cdk/list    — 管理员接口（需 JWT），列出所有 CDK
 * PUT  /api/cdk/toggle/:id — 管理员接口，启用/禁用 CDK
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { query, queryOne, run } = require('../database');
const authMiddleware = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// Pure Node.js TOTP implementation (RFC 6238 — HMAC-SHA1, 6 digits, 30s step)
// Zero external dependencies — replaces otplib which broke in v13
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decode a Base32-encoded string into a Buffer.
 */
function base32Decode(encoded) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const stripped = encoded.replace(/[=\s]/g, '').toUpperCase();
  let bits = '';
  for (const ch of stripped) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generate a 6-digit TOTP code from a Base32-encoded secret.
 * Compatible with Google Authenticator / Authy.
 */
function generateTOTP(secret) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter & 0xFFFFFFFF, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Seconds remaining in the current 30-second TOTP window.
 */
function timeRemaining() {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter for CDK verify — max 10 attempts per 5 minutes per IP
// ─────────────────────────────────────────────────────────────────────────────
const cdkVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: '验证请求过于频繁，请5分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cdk/verify — 公开：校验 CDK → 本地生成 TOTP → 返回聚合响应
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', cdkVerifyLimiter, async (req, res) => {
  try {
    const { code } = req.body;

    // ── 1. 参数校验 ──
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ error: '请输入有效的 CDK 凭证' });
    }

    const cdkCode = code.trim().toUpperCase();

    // ── 2. 查询 CDK ──
    const cdk = await queryOne(
      `SELECT id, code, totp_secret, tutorial_text, contact_base64,
              max_uses, used_count, is_active, expires_at
       FROM cdk_codes WHERE UPPER(code) = $1`,
      [cdkCode]
    );

    if (!cdk) {
      return res.status(404).json({ error: 'CDK 凭证不存在' });
    }

    // ── 3. 状态与有效期校验 ──
    if (!cdk.is_active) {
      return res.status(403).json({ error: '该 CDK 已被禁用' });
    }

    if (cdk.expires_at && new Date(cdk.expires_at) < new Date()) {
      return res.status(403).json({ error: '该 CDK 已过期' });
    }

    if (cdk.max_uses > 0 && cdk.used_count >= cdk.max_uses) {
      return res.status(403).json({ error: '该 CDK 已达最大使用次数' });
    }

    // ── 4. 本地 TOTP 生成（核心安全点：密钥永远不离开服务端）──
    //   使用 Node.js 内置 crypto 模块，RFC 6238 标准实现：
    //     - algorithm: HMAC-SHA1
    //     - digits: 6
    //     - step: 30 秒
    //   与 Google Authenticator / Authy 完全兼容
    const totpCode = generateTOTP(cdk.totp_secret);
    const remaining = timeRemaining();

    // ── 5. 记录使用日志 ──
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    await run(
      `INSERT INTO cdk_usage_log (cdk_id, ip_address, user_agent)
       VALUES ($1, $2, $3)`,
      [cdk.id, clientIp, userAgent.substring(0, 512)]
    );

    // ── 6. 更新使用计数 ──
    await run(
      `UPDATE cdk_codes SET used_count = used_count + 1 WHERE id = $1`,
      [cdk.id]
    );

    // ── 7. 组装响应 ──
    //
    //   - code2fa:       六位 TOTP 数字（明文，仅短期有效）
    //   - timeRemaining: 当前 TOTP 窗口剩余秒数
    //   - tutorial:      教程文本（可包含 HTML）
    //   - contactBase64: Base64 编码的客服微信 ID，前端解码后渲染
    //
    res.json({
      success: true,
      code2fa: totpCode,
      timeRemaining: remaining,
      tutorial: cdk.tutorial_text || '',
      contactBase64: cdk.contact_base64 || '',
    });
  } catch (err) {
    console.error('POST /api/cdk/verify error:', err);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cdk/create — 管理员：创建新 CDK
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      code,
      totp_secret,
      tutorial_text = '',
      contact_base64 = '',
      max_uses = 0,       // 0 = 无限制
      expires_days = 0,   // 0 = 永不过期
    } = req.body;

    if (!code || !totp_secret) {
      return res.status(400).json({ error: 'CDK 编码 和 TOTP 密钥 为必填项' });
    }

    // 检查是否重复
    const existing = await queryOne('SELECT id FROM cdk_codes WHERE UPPER(code) = $1', [code.toUpperCase()]);
    if (existing) {
      return res.status(409).json({ error: '该 CDK 编码已存在' });
    }

    const expiresAt = expires_days > 0
      ? new Date(Date.now() + expires_days * 86400000).toISOString()
      : null;

    const result = await run(
      `INSERT INTO cdk_codes (code, totp_secret, tutorial_text, contact_base64, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [code.toUpperCase(), totp_secret, tutorial_text, contact_base64, max_uses, expiresAt]
    );

    res.json({ success: true, id: result.rows[0].id, code: code.toUpperCase() });
  } catch (err) {
    console.error('POST /api/cdk/create error:', err);
    res.status(500).json({ error: '创建 CDK 失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cdk/list — 管理员：列出所有 CDK
// ─────────────────────────────────────────────────────────────────────────────
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, code, max_uses, used_count, is_active, created_at, expires_at
       FROM cdk_codes ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cdk/list error:', err);
    res.status(500).json({ error: '获取 CDK 列表失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cdk/toggle/:id — 管理员：启用/禁用 CDK
// ─────────────────────────────────────────────────────────────────────────────
router.put('/toggle/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await run(
      `UPDATE cdk_codes SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'CDK 不存在' });
    }
    res.json({ success: true, id: Number(id), is_active: result.rows[0].is_active });
  } catch (err) {
    console.error('PUT /api/cdk/toggle error:', err);
    res.status(500).json({ error: '操作失败' });
  }
});

module.exports = router;
