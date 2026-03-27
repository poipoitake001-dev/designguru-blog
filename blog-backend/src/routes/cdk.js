/**
 * CDK Routes — 凭证校验 + 本地 TOTP 生成 + 管理
 *
 * POST /api/cdk/verify        — 公开接口，校验 CDK 并返回 TOTP + 教程列表 + 客服 ID
 * POST /api/cdk/refresh-totp  — 公开接口，刷新 TOTP（不增加使用计数）
 * POST /api/cdk/create        — 管理员接口（需 JWT），创建新 CDK
 * GET  /api/cdk/list          — 管理员接口（需 JWT），列出所有 CDK
 * PUT  /api/cdk/toggle/:id    — 管理员接口，启用/禁用 CDK
 * PUT  /api/cdk/articles/:id  — 管理员接口，更新 CDK 绑定的教程列表
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { query, queryOne, run } = require('../database');
const authMiddleware = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// Pure Node.js TOTP implementation (RFC 6238 — HMAC-SHA1, 6 digits, 30s step)
// ─────────────────────────────────────────────────────────────────────────────

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

function timeRemaining() {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiters
// ─────────────────────────────────────────────────────────────────────────────
const cdkVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: '验证请求过于频繁，请5分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const cdkRefreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: '刷新请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: validate & sanitize an array of IDs to safe positive integers
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeIntArray(arr, fieldName = 'ids') {
  if (!Array.isArray(arr)) return { error: `${fieldName} 必须为数组` };
  const result = [];
  for (const item of arr) {
    const n = Number(item);
    if (!Number.isInteger(n) || n <= 0) {
      return { error: `${fieldName} 包含非法值` };
    }
    result.push(n);
  }
  return { data: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: validate CDK and return the record (shared by verify & refresh)
// ─────────────────────────────────────────────────────────────────────────────
async function validateCdk(code) {
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return { error: '请输入有效的 CDK 凭证', status: 400 };
  }
  if (code.trim().length > 50) {
    return { error: 'CDK 凭证格式不正确', status: 400 };
  }
  const cdkCode = code.trim().toUpperCase();
  const cdk = await queryOne(
    `SELECT id, code, totp_secret, contact_base64,
            account_username, account_password,
            max_uses, used_count, is_active, expires_at
     FROM cdk_codes WHERE UPPER(code) = $1`,
    [cdkCode]
  );
  if (!cdk) return { error: 'CDK 凭证不存在', status: 404 };
  if (!cdk.is_active) return { error: '该 CDK 已被禁用', status: 403 };
  if (cdk.expires_at && new Date(cdk.expires_at) < new Date()) {
    return { error: '该 CDK 已过期', status: 403 };
  }
  if (cdk.max_uses > 0 && cdk.used_count >= cdk.max_uses) {
    return { error: '该 CDK 已达最大使用次数', status: 403 };
  }
  return { cdk };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch linked articles for a CDK
// ─────────────────────────────────────────────────────────────────────────────
async function getLinkedArticles(cdkId) {
  const rows = await query(
    `SELECT a.id, a.title, a.content
     FROM cdk_articles ca
     JOIN articles a ON a.id = ca.article_id
     WHERE ca.cdk_id = $1
     ORDER BY ca.sort_order ASC, ca.id ASC`,
    [cdkId]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cdk/verify — 公开：校验 CDK → TOTP + 绑定教程列表
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', cdkVerifyLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    const result = await validateCdk(code);
    if (result.error) return res.status(result.status).json({ error: result.error });

    const { cdk } = result;
    const totpCode = generateTOTP(cdk.totp_secret);
    const remaining = timeRemaining();

    // 记录使用日志
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    await run(
      `INSERT INTO cdk_usage_log (cdk_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
      [cdk.id, clientIp, userAgent.substring(0, 512)]
    );

    // 更新使用计数
    await run(`UPDATE cdk_codes SET used_count = used_count + 1 WHERE id = $1`, [cdk.id]);

    // 获取绑定的教程列表
    const tutorials = await getLinkedArticles(cdk.id);

    // Fallback: 如果 CDK 本身没有设置 contact_base64，则使用全局默认配置
    let finalContactBase64 = cdk.contact_base64 || '';
    if (!finalContactBase64) {
      const globalSetting = await queryOne(
        "SELECT value FROM site_settings WHERE key = 'default_contact_base64'"
      );
      finalContactBase64 = globalSetting?.value || '';
    }

    res.json({
      success: true,
      code2fa: totpCode,
      timeRemaining: remaining,
      tutorials,
      contactBase64: finalContactBase64,
      accountUsername: cdk.account_username || '',
      accountPassword: cdk.account_password || '',
    });
  } catch (err) {
    console.error('POST /api/cdk/verify error:', err);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cdk/refresh-totp — 公开：刷新 TOTP（不增加 used_count）
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refresh-totp', cdkRefreshLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    const result = await validateCdk(code);
    if (result.error) return res.status(result.status).json({ error: result.error });

    const { cdk } = result;
    const totpCode = generateTOTP(cdk.totp_secret);
    const remaining = timeRemaining();

    res.json({
      success: true,
      code2fa: totpCode,
      timeRemaining: remaining,
    });
  } catch (err) {
    console.error('POST /api/cdk/refresh-totp error:', err);
    res.status(500).json({ error: '刷新失败' });
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
      contact_base64 = '',
      account_username = '',
      account_password = '',
      max_uses = 0,
      expires_days = 0,
      article_ids = [],
    } = req.body;

    if (!code || !totp_secret) {
      return res.status(400).json({ error: 'CDK 编码 和 TOTP 密钥 为必填项' });
    }

    // 字段长度校验
    if (code.length > 50) return res.status(400).json({ error: 'CDK 编码过长（最多50字符）' });
    if (totp_secret.length > 64) return res.status(400).json({ error: 'TOTP 密钥过长' });
    if (account_username.length > 200) return res.status(400).json({ error: '账号过长' });
    if (account_password.length > 200) return res.status(400).json({ error: '密码过长' });
    if (contact_base64.length > 2000) return res.status(400).json({ error: '联系方式过长' });

    // 校验 article_ids
    if (article_ids.length > 0) {
      const check = sanitizeIntArray(article_ids, 'article_ids');
      if (check.error) return res.status(400).json({ error: check.error });
    }

    const existing = await queryOne('SELECT id FROM cdk_codes WHERE UPPER(code) = $1', [code.toUpperCase()]);
    if (existing) {
      return res.status(409).json({ error: '该 CDK 编码已存在' });
    }

    const expiresAt = expires_days > 0
      ? new Date(Date.now() + expires_days * 86400000).toISOString()
      : null;

    const result = await run(
      `INSERT INTO cdk_codes (code, totp_secret, contact_base64, account_username, account_password, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [code.toUpperCase(), totp_secret, contact_base64, account_username, account_password, max_uses, expiresAt]
    );

    const newId = result.rows[0].id;

    // 批量插入教程关联
    if (article_ids.length > 0) {
      const values = article_ids.map((aid, i) => `($1, $${i + 2}, ${i})`).join(', ');
      await run(
        `INSERT INTO cdk_articles (cdk_id, article_id, sort_order) VALUES ${values}`,
        [newId, ...article_ids]
      );
    }

    res.json({ success: true, id: newId, code: code.toUpperCase() });
  } catch (err) {
    console.error('POST /api/cdk/create error:', err);
    res.status(500).json({ error: '创建 CDK 失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cdk/batch-delete — 管理员：批量删除多个 CDK
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/batch-delete', authMiddleware, async (req, res) => {
  try {
    const { ids: rawIds } = req.body;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: '请选择要删除的 CDK' });
    }
    const idCheck = sanitizeIntArray(rawIds, 'ids');
    if (idCheck.error) return res.status(400).json({ error: idCheck.error });
    const ids = idCheck.data;

    // 生成参数占位符 $1, $2, $3 ...
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

    // 先清理子表依赖
    await run(`DELETE FROM cdk_usage_log WHERE cdk_id IN (${placeholders})`, ids);
    await run(`DELETE FROM cdk_articles WHERE cdk_id IN (${placeholders})`, ids);

    // 删除主记录
    const result = await run(`DELETE FROM cdk_codes WHERE id IN (${placeholders}) RETURNING id`, ids);

    res.json({ success: true, deletedCount: result.rowCount });
  } catch (err) {
    console.error('DELETE /api/cdk/batch-delete error:', err);
    res.status(500).json({ error: '批量删除失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cdk/batch-bind-articles — 管理员：批量为多个 CDK 绑定教程
// ─────────────────────────────────────────────────────────────────────────────
router.put('/batch-bind-articles', authMiddleware, async (req, res) => {
  try {
    const { ids: rawIds, article_ids: rawArticleIds = [] } = req.body;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: '请选择要操作的 CDK' });
    }
    const idCheck = sanitizeIntArray(rawIds, 'ids');
    if (idCheck.error) return res.status(400).json({ error: idCheck.error });
    const ids = idCheck.data;
    const artCheck = sanitizeIntArray(rawArticleIds, 'article_ids');
    if (artCheck.error) return res.status(400).json({ error: artCheck.error });
    const article_ids = artCheck.data;

    for (const cdkId of ids) {
      // 删除旧关联
      await run('DELETE FROM cdk_articles WHERE cdk_id = $1', [cdkId]);

      // 插入新关联
      if (article_ids.length > 0) {
        const values = article_ids.map((aid, i) => `($1, $${i + 2}, ${i})`).join(', ');
        await run(
          `INSERT INTO cdk_articles (cdk_id, article_id, sort_order) VALUES ${values}`,
          [cdkId, ...article_ids]
        );
      }
    }

    res.json({ success: true, updatedCount: ids.length });
  } catch (err) {
    console.error('PUT /api/cdk/batch-bind-articles error:', err);
    res.status(500).json({ error: '批量绑定教程失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cdk/list — 管理员：列出所有 CDK（含绑定教程数量）
// ─────────────────────────────────────────────────────────────────────────────
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT c.id, c.code, c.totp_secret, c.contact_base64,
              c.account_username, c.account_password,
              c.max_uses, c.used_count, c.is_active, c.created_at, c.expires_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', a.id, 'title', a.title) ORDER BY ca.sort_order)
                 FROM cdk_articles ca JOIN articles a ON a.id = ca.article_id
                 WHERE ca.cdk_id = c.id), '[]'
              ) AS linked_articles
       FROM cdk_codes c
       ORDER BY c.created_at DESC`
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

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cdk/:id — 管理员：编辑 CDK 属性
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, totp_secret, contact_base64, account_username, account_password, max_uses, expires_days } = req.body;

    if (!code || !totp_secret) {
      return res.status(400).json({ error: 'CDK 编码 和 TOTP 密钥 为必填项' });
    }

    // 字段长度校验
    if (code.length > 50) return res.status(400).json({ error: 'CDK 编码过长（最多50字符）' });
    if (totp_secret.length > 64) return res.status(400).json({ error: 'TOTP 密钥过长' });
    if ((account_username || '').length > 200) return res.status(400).json({ error: '账号过长' });
    if ((account_password || '').length > 200) return res.status(400).json({ error: '密码过长' });
    if ((contact_base64 || '').length > 2000) return res.status(400).json({ error: '联系方式过长' });

    // 检查 CDK 是否存在
    const existing = await queryOne('SELECT id FROM cdk_codes WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'CDK 不存在' });

    // 校验 code 是否与其他 CDK 重名（排除自身 ID）
    const conflict = await queryOne(
      'SELECT id FROM cdk_codes WHERE UPPER(code) = $1 AND id != $2',
      [code.toUpperCase(), id]
    );
    if (conflict) return res.status(409).json({ error: '该 CDK 编码已被其他凭证使用' });

    const expiresAt = expires_days > 0
      ? new Date(Date.now() + expires_days * 86400000).toISOString()
      : null;

    await run(
      `UPDATE cdk_codes
       SET code = $1, totp_secret = $2, contact_base64 = $3,
           account_username = $4, account_password = $5,
           max_uses = $6, expires_at = $7
       WHERE id = $8`,
      [code.toUpperCase(), totp_secret, contact_base64 || '', account_username || '', account_password || '', max_uses || 0, expiresAt, id]
    );

    res.json({ success: true, id: Number(id) });
  } catch (err) {
    console.error('PUT /api/cdk/:id error:', err);
    res.status(500).json({ error: '更新 CDK 失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cdk/:id — 管理员：删除 CDK（先清理子依赖）
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 先清理子表依赖，防止外键约束报错
    await run('DELETE FROM cdk_usage_log WHERE cdk_id = $1', [id]);
    await run('DELETE FROM cdk_articles WHERE cdk_id = $1', [id]);

    // 删除主记录
    const result = await run('DELETE FROM cdk_codes WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'CDK 不存在' });
    }
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    console.error('DELETE /api/cdk/:id error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cdk/articles/:id — 管理员：更新 CDK 绑定的教程列表
// ─────────────────────────────────────────────────────────────────────────────
router.put('/articles/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { article_ids: rawArticleIds = [] } = req.body;
    const artCheck = sanitizeIntArray(rawArticleIds, 'article_ids');
    if (artCheck.error) return res.status(400).json({ error: artCheck.error });
    const article_ids = artCheck.data;

    // 检查 CDK 是否存在
    const cdk = await queryOne('SELECT id FROM cdk_codes WHERE id = $1', [id]);
    if (!cdk) return res.status(404).json({ error: 'CDK 不存在' });

    // 删除旧关联
    await run('DELETE FROM cdk_articles WHERE cdk_id = $1', [id]);

    // 批量插入新关联
    if (article_ids.length > 0) {
      const values = article_ids.map((aid, i) => `($1, $${i + 2}, ${i})`).join(', ');
      await run(
        `INSERT INTO cdk_articles (cdk_id, article_id, sort_order) VALUES ${values}`,
        [Number(id), ...article_ids]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/cdk/articles error:', err);
    res.status(500).json({ error: '更新教程关联失败' });
  }
});

module.exports = router;
