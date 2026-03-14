/**
 * Database module — PostgreSQL via Neon
 *
 * Uses the `pg` (node-postgres) library with a connection pool.
 * Connection string is read from the DATABASE_URL environment variable.
 *
 * For local development: create a .env file in blog-backend/ with:
 *   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
 */

require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL environment variable is not set. Please create a .env file or set it in your deployment platform.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon / Render / most cloud PG
});

/**
 * Initialize database tables.
 * Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS.
 */
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT '前端开发',
        summary     TEXT NOT NULL DEFAULT '',
        cover_image TEXT NOT NULL DEFAULT '',
        content     TEXT NOT NULL DEFAULT '',
        author      TEXT NOT NULL DEFAULT 'Admin',
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS about (
        id      INTEGER PRIMARY KEY CHECK (id = 1),
        name    TEXT NOT NULL DEFAULT 'Design_Guru',
        avatar  TEXT NOT NULL DEFAULT '',
        bio     TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        email   TEXT NOT NULL DEFAULT '',
        github  TEXT NOT NULL DEFAULT '',
        twitter TEXT NOT NULL DEFAULT ''
      )
    `);

    // ── CDK 凭证表：存储 CDK 编码、TOTP 密钥、教程文本、客服联系方式 ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS cdk_codes (
        id             SERIAL PRIMARY KEY,
        code           TEXT NOT NULL UNIQUE,
        totp_secret    TEXT NOT NULL,
        tutorial_text  TEXT NOT NULL DEFAULT '',
        contact_base64 TEXT NOT NULL DEFAULT '',
        max_uses       INTEGER NOT NULL DEFAULT 0,
        used_count     INTEGER NOT NULL DEFAULT 0,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at     TIMESTAMPTZ
      )
    `);

    // ── CDK 使用日志：记录每次验证的 IP 和 UA（安全审计）──
    await client.query(`
      CREATE TABLE IF NOT EXISTS cdk_usage_log (
        id         SERIAL PRIMARY KEY,
        cdk_id     INTEGER NOT NULL REFERENCES cdk_codes(id),
        ip_address TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default site settings if not exist
    const defaults = {
      site_name: 'DesignGuru',
      hero_title: '探索 设计与代码的边界',
      hero_subtitle: '分享最新的前端技术、Vanilla CSS 技巧以及具有高级质感的 UI/UX 教程',
      logo_url: ''
    };

    for (const [key, value] of Object.entries(defaults)) {
      await client.query(
        'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, value]
      );
    }

    // Seed default about page if not exist
    await client.query(`
      INSERT INTO about (id, name, avatar, bio, content, email, github, twitter)
      VALUES (1, 'Design_Guru', '', '资深 UI/UX 设计师，专注于创造有质感的数字体验。',
              '<p>我是一名拥有多年经验的设计师和开发者，热衷于探索设计与技术的交汇点。</p>
               <p>在这个博客中，我将分享关于前端开发、CSS 动画、设计系统以及用户体验的深度教程。</p>',
              '', '', '')
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('✅ Database tables initialized.');
  } finally {
    client.release();
  }
}

/**
 * Execute a parameterized query and return all rows.
 * @param {string} sql - SQL with $1, $2 ... placeholders
 * @param {Array}  params - Parameter values
 */
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Execute and return the first row (or null).
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Execute a write query (INSERT / UPDATE / DELETE).
 * Returns the pg QueryResult (includes rowCount, rows).
 */
async function run(sql, params = []) {
  return pool.query(sql, params);
}

module.exports = { initDb, query, queryOne, run };
