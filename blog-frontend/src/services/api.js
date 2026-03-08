/**
 * API Service Layer
 *
 * Base URL is read from the VITE_API_URL environment variable.
 * - Local dev:  set in blog-frontend/.env.local   → http://localhost:3001/api
 * - Production: set in Vercel dashboard            → https://your-backend.onrender.com/api
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ---- Articles ----

export async function fetchTutorials() {
    const res = await fetch(`${API_BASE}/articles`);
    if (!res.ok) throw new Error('获取教程列表失败');
    return res.json();
}

export async function fetchTutorialDetail(id) {
    const res = await fetch(`${API_BASE}/articles/${id}`);
    if (!res.ok) throw new Error('获取教程详情失败');
    return res.json();
}

export async function createArticle(payload) {
    const res = await fetch(`${API_BASE}/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('创建文章失败');
    return res.json();
}

export async function updateArticle(id, payload) {
    const res = await fetch(`${API_BASE}/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('更新文章失败');
    return res.json();
}

export async function deleteArticle(id) {
    const res = await fetch(`${API_BASE}/articles/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('删除文章失败');
    return res.json();
}

// ---- Upload ----

export async function uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('文件上传失败');
    const data = await res.json();

    // Resolve relative URLs (local) to absolute (production already absolute)
    const base = API_BASE.replace('/api', '');
    const toAbsolute = (url) =>
        url.startsWith('http') ? url : `${base}${url}`;

    return {
        url: toAbsolute(data.url),
        alt: data.alt,
        href: toAbsolute(data.href || data.url)
    };
}

// ---- Site Settings ----

export async function fetchSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('获取站点设置失败');
    return res.json();
}

export async function updateSettings(settings) {
    const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('更新站点设置失败');
    return res.json();
}

// ---- About Page ----

export async function fetchAbout() {
    const res = await fetch(`${API_BASE}/about`);
    if (!res.ok) throw new Error('获取关于页面失败');
    return res.json();
}

export async function updateAbout(aboutData) {
    const res = await fetch(`${API_BASE}/about`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aboutData)
    });
    if (!res.ok) throw new Error('更新关于页面失败');
    return res.json();
}
