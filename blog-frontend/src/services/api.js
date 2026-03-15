/**
 * API Service Layer
 *
 * Base URL is read from the VITE_API_URL environment variable.
 * - Local dev:  set in blog-frontend/.env.local   → http://localhost:3001/api
 * - Production: set in Vercel dashboard            → https://your-backend.onrender.com/api
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ---- Auth helpers ----

function getToken() {
    return localStorage.getItem('admin_token');
}

function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/** If API returns 401, clear token and redirect to login */
function handle401(res) {
    if (res.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
    }
    return res;
}

// ---- Auth ----

export async function login(password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '密码错误，请重试');
    }
    return res.json();
}

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
    const res = handle401(await fetch(`${API_BASE}/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
    }));
    if (!res.ok) throw new Error('创建文章失败');
    return res.json();
}

export async function updateArticle(id, payload) {
    const res = handle401(await fetch(`${API_BASE}/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
    }));
    if (!res.ok) throw new Error('更新文章失败');
    return res.json();
}

export async function deleteArticle(id) {
    const res = handle401(await fetch(`${API_BASE}/articles/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders() }
    }));
    if (!res.ok) throw new Error('删除文章失败');
    return res.json();
}

// ---- Upload ----

export async function uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = handle401(await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { ...authHeaders() },   // NOTE: do NOT set Content-Type for multipart
        body: formData
    }));
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '文件上传失败');
    }
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
    const res = handle401(await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(settings)
    }));
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
    const res = handle401(await fetch(`${API_BASE}/about`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(aboutData)
    }));
    if (!res.ok) throw new Error('更新关于页面失败');
    return res.json();
}

// ---- CDK Verify ----

export async function verifyCdk(code) {
    const res = await fetch(`${API_BASE}/cdk/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'CDK 验证失败');
    }
    return res.json();
}

export async function refreshTotp(code) {
    const res = await fetch(`${API_BASE}/cdk/refresh-totp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '刷新验证码失败');
    }
    return res.json();
}

// ---- Admin CDK Management ----

export async function fetchCdks() {
    const res = handle401(await fetch(`${API_BASE}/cdk/list`, {
        headers: authHeaders()
    }));
    if (!res.ok) throw new Error('获取 CDK 列表失败');
    return res.json();
}

export async function createCdk(cdkData) {
    const res = handle401(await fetch(`${API_BASE}/cdk/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(cdkData)
    }));
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '创建 CDK 失败');
    }
    return res.json();
}

export async function toggleCdkStatus(id) {
    const res = handle401(await fetch(`${API_BASE}/cdk/toggle/${id}`, {
        method: 'PUT',
        headers: authHeaders()
    }));
    if (!res.ok) throw new Error('更新 CDK 状态失败');
    return res.json();
}

export async function updateCdkArticles(id, articleIds) {
    const res = handle401(await fetch(`${API_BASE}/cdk/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ article_ids: articleIds })
    }));
    if (!res.ok) throw new Error('更新教程关联失败');
    return res.json();
}

