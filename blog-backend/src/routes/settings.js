/**
 * Site Settings & About Routes — PostgreSQL version
 *
 * Public:
 *   GET  /api/settings   - Get all site settings as key-value object
 *   GET  /api/about      - Get about page content
 *
 * Admin:
 *   PUT  /api/settings   - Update site settings
 *   PUT  /api/about      - Update about page content
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database');
const { requireAuth } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// PUBLIC: Get all site settings
// ---------------------------------------------------------------------------
router.get('/settings', async (req, res) => {
    try {
        const rows = await query('SELECT key, value FROM site_settings');
        const settings = {};
        for (const row of rows) {
            settings[row.key] = row.value;
        }
        res.json({ data: settings });
    } catch (err) {
        console.error('GET /api/settings error:', err);
        res.status(500).json({ error: '获取站点设置失败' });
    }
});

// ---------------------------------------------------------------------------
// ADMIN: Update site settings
// ---------------------------------------------------------------------------
router.put('/settings', requireAuth, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            await run(
                'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
                [key, value]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/settings error:', err);
        res.status(500).json({ error: '更新站点设置失败' });
    }
});

// ---------------------------------------------------------------------------
// PUBLIC: Get about page content
// ---------------------------------------------------------------------------
router.get('/about', async (req, res) => {
    try {
        const about = await queryOne(
            'SELECT name, avatar, bio, content, email, github, twitter FROM about WHERE id = 1'
        );
        res.json({ data: about || {} });
    } catch (err) {
        console.error('GET /api/about error:', err);
        res.status(500).json({ error: '获取关于页面失败' });
    }
});

// ---------------------------------------------------------------------------
// ADMIN: Update about page content
// ---------------------------------------------------------------------------
router.put('/about', requireAuth, async (req, res) => {
    try {
        const { name, avatar, bio, content, email, github, twitter } = req.body;

        await run(`
      INSERT INTO about (id, name, avatar, bio, content, email, github, twitter)
      VALUES (1, $1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name    = EXCLUDED.name,
        avatar  = EXCLUDED.avatar,
        bio     = EXCLUDED.bio,
        content = EXCLUDED.content,
        email   = EXCLUDED.email,
        github  = EXCLUDED.github,
        twitter = EXCLUDED.twitter
    `, [
            name || '',
            avatar || '',
            bio || '',
            content || '',
            email || '',
            github || '',
            twitter || ''
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/about error:', err);
        res.status(500).json({ error: '更新关于页面失败' });
    }
});

module.exports = router;
