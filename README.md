# DesignGuru Blog

一个前后端分离的独立博客网站，专注于分享前端技术与 UI/UX 设计教程。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + Vanilla CSS |
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL（Neon） |
| 富文本编辑器 | WangEditor v5 |

## 项目结构

```
├── blog-frontend/   # React 前端，部署到 Vercel
└── blog-backend/    # Express 后端，部署到 Render
```

## 本地开发

### 前置条件
- Node.js >= 18
- 一个 Neon PostgreSQL 数据库（[免费注册](https://neon.tech)）

### 后端

```bash
cd blog-backend
cp .env.example .env
# 编辑 .env 填入你的 DATABASE_URL
npm install
npm run seed   # 初始化数据库和示例数据
npm run dev    # 启动开发服务器 http://localhost:3001
```

### 前端

```bash
cd blog-frontend
# .env.local 已预设指向 localhost:3001
npm install
npm run dev    # 启动开发服务器 http://localhost:5173
```

## 部署

参考 `blog-backend/.env.example` 和 `blog-frontend/.env.example` 配置环境变量。

- **前端** → [Vercel](https://vercel.com)，设置 `VITE_API_URL`
- **后端** → [Render](https://render.com)，至少设置 `DATABASE_URL`、`FRONTEND_URL`、`JWT_SECRET`，以及 `ADMIN_PASSWORD`（或 `ADMIN_PASSWORD_HASH`）
- **数据库** → [Neon](https://neon.tech)，创建项目后复制连接串

## 功能

- 📖 教程文章的发布、编辑、删除
- 🖼️ 图片/视频上传
- 🌙 暗黑/亮色模式切换  
- 👤 关于作者页面
- ⚙️ 站点设置（Logo、首页标题）
- 🔒 管理后台独立入口（`/admin`）
