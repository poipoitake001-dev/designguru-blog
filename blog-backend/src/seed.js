/**
 * Database Seed Script — PostgreSQL version
 * Run with: npm run seed
 *
 * Requires DATABASE_URL to be set in environment (or .env file).
 */

require('dotenv').config();
const { initDb, run, query } = require('./database');

const sampleArticles = [
  {
    title: '现代 Web 设计：如何运用玻璃态 (Glassmorphism)',
    category: 'UI/UX 设计',
    summary: '深入解析如何在 UI 设计中实现高级的毛玻璃质感，包括 CSS backdrop-filter 的最佳实践与性能优化。',
    cover_image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=800&auto=format&fit=crop',
    content: `<p>在现代 Web 应用中，玻璃态（Glassmorphism）设计风格已经成为一种极具辨识度的视觉语言。</p>
<h2>核心原理</h2>
<p>实现玻璃态效果的关键 CSS 属性是 <code>backdrop-filter</code>。</p>
<pre><code>.glass-panel {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
}</code></pre>
<blockquote>"设计不仅仅是外观和感觉。设计是工作原理。" —— 乔布斯</blockquote>`,
    author: 'Design_Guru',
    published_at: '2026-03-01T10:00:00Z'
  },
  {
    title: 'Vanilla CSS 动画指南：丝滑交互的秘密',
    category: '前端开发',
    summary: '抛弃庞大的动画库，学习使用原生 CSS transition 和 animation 属性打造极致流畅的用户体验。',
    cover_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
    content: `<p>CSS 动画是 Web 交互设计的核心能力。原生 CSS 动画具备更好的性能。</p>
<h2>关键技巧：贝塞尔曲线</h2>
<pre><code>.element {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.element:hover {
  transform: translateY(-4px) scale(1.02);
}</code></pre>
<h2>性能黄金法则</h2>
<p>只对 <code>transform</code> 和 <code>opacity</code> 做动画！避免对 <code>width</code>、<code>height</code> 等布局属性做动画。</p>`,
    author: 'Design_Guru',
    published_at: '2026-03-05T14:30:00Z'
  },
  {
    title: '构建暗黑模式：从色彩系统到代码实现',
    category: '全栈实践',
    summary: '系统讲解如何通过 CSS 变量和 HSL 色彩空间构建一套可扩展的、令人惊叹的暗色主题系统。',
    cover_image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop',
    content: `<p>暗黑模式已经从一个"额外功能"变成了现代应用的标配。</p>
<h2>使用 CSS 变量构建主题系统</h2>
<pre><code>:root {
  --bg-primary: #f8fafc;
  --text-primary: #0f172a;
}
html.dark {
  --bg-primary: #0f172a;
  --text-primary: #f8fafc;
}</code></pre>`,
    author: 'Dev_Master',
    published_at: '2026-03-07T08:00:00Z'
  }
];

async function seed() {
  console.log('🌱 Connecting to database...');
  await initDb();

  console.log('🧹 Clearing existing articles...');
  await run('DELETE FROM articles');

  console.log('📝 Inserting sample articles...');
  for (const article of sampleArticles) {
    await run(`
      INSERT INTO articles (title, category, summary, cover_image, content, author, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      article.title,
      article.category,
      article.summary,
      article.cover_image,
      article.content,
      article.author,
      article.published_at
    ]);
  }

  const rows = await query('SELECT COUNT(*) AS count FROM articles');
  console.log(`✅ Seeded ${rows[0].count} articles into the database.`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
