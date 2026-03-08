/**
 * Article Routes — PostgreSQL version
 *
 * Public:
 *   GET  /api/articles       - List all articles
 *   GET  /api/articles/:id   - Get single article with full content
 *
 * Admin:
 *   POST   /api/articles       - Create a new article
 *   PUT    /api/articles/:id   - Update an existing article
 *   DELETE /api/articles/:id   - Delete an article
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../database');

// ---------------------------------------------------------------------------
// PUBLIC: Get all articles (without full content)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const articles = await query(`
      SELECT id, title, category, summary,
             cover_image AS "coverImage",
             author,
             published_at AS "publishedAt",
             updated_at  AS "updatedAt"
      FROM articles
      ORDER BY published_at DESC
    `);
        res.json({ data: articles });
    } catch (err) {
        console.error('GET /api/articles error:', err);
        res.status(500).json({ error: '获取文章列表失败' });
    }
});

// ---------------------------------------------------------------------------
// PUBLIC: Get single article detail
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
    try {
        const article = await queryOne(`
      SELECT id, title, category, summary,
             cover_image AS "coverImage",
             content, author,
             published_at AS "publishedAt",
             updated_at  AS "updatedAt"
      FROM articles
      WHERE id = $1
    `, [Number(req.params.id)]);

        if (!article) {
            return res.status(404).json({ error: '文章不存在' });
        }
        res.json({ data: article });
    } catch (err) {
        console.error('GET /api/articles/:id error:', err);
        res.status(500).json({ error: '获取文章详情失败' });
    }
});

// ---------------------------------------------------------------------------
// ADMIN: Create a new article
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
    try {
        const { title, category, summary, coverImage, content, author } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: '标题不能为空' });
        }

        // RETURNING id gives us the new row's ID immediately
        const result = await run(`
      INSERT INTO articles (title, category, summary, cover_image, content, author)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
            title.trim(),
            category || '前端开发',
            summary || '',
            coverImage || '',
            content || '',
            author || 'Admin'
        ]);

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error('POST /api/articles error:', err);
        res.status(500).json({ error: '创建文章失败' });
    }
});

// ---------------------------------------------------------------------------
// ADMIN: Update an existing article
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
    try {
        const { title, category, summary, coverImage, content, author } = req.body;
        const articleId = Number(req.params.id);

        const existing = await queryOne('SELECT id FROM articles WHERE id = $1', [articleId]);
        if (!existing) {
            return res.status(404).json({ error: '文章不存在' });
        }

        await run(`
      UPDATE articles
      SET title = $1, category = $2, summary = $3, cover_image = $4,
          content = $5, author = $6, updated_at = NOW()
      WHERE id = $7
    `, [
            title ?? '',
            category ?? '前端开发',
            summary ?? '',
            coverImage ?? '',
            content ?? '',
            author ?? 'Admin',
            articleId
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/articles/:id error:', err);
        res.status(500).json({ error: '更新文章失败' });
    }
});

// ---------------------------------------------------------------------------
// ADMIN: Delete an article
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
    try {
        const articleId = Number(req.params.id);

        const existing = await queryOne('SELECT id FROM articles WHERE id = $1', [articleId]);
        if (!existing) {
            return res.status(404).json({ error: '文章不存在' });
        }

        await run('DELETE FROM articles WHERE id = $1', [articleId]);
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/articles/:id error:', err);
        res.status(500).json({ error: '删除文章失败' });
    }
});

module.exports = router;
