/**
 * SecureContentLoader — CDK 凭证校验 + 动态渲染 2FA 验证密钥与教程模块
 *
 * 流程:
 *   1. 用户输入 CDK → POST /api/cdk/verify
 *   2. 后端返回 TOTP + 绑定教程列表 + 客服微信 Base64
 *   3. 前端销毁输入框，原位渲染 2FA 密钥（自动刷新）+ 教程卡片列表 + 客服浮窗
 *
 * 增强功能:
 *   - 教程图片双击放大（ImageLightbox）
 *   - 教程章节导航（从 h1–h4 提取生成侧边栏导航）
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContactObfuscator from './ContactObfuscator';
import ImageLightbox from './ImageLightbox';
import './SecureContentLoader.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** 从 HTML 字符串中提取 h1–h4 标题，用于章节导航 */
function extractHeadings(htmlString, tutId) {
    if (!htmlString) return [];
    const headings = [];
    const regex = /<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    let idx = 0;
    while ((match = regex.exec(htmlString)) !== null) {
        const level = parseInt(match[1][1], 10);
        // 移除 HTML 标签，提取纯文本
        const text = match[2].replace(/<[^>]*>/g, '').trim();
        if (text) {
            headings.push({ id: `tut-${tutId}-heading-${idx}`, level, text });
            idx++;
        }
    }
    return headings;
}

/** 在 HTML 字符串中为 h1–h4 注入唯一 ID */
function injectHeadingIds(htmlString, tutId) {
    if (!htmlString) return htmlString;
    let idx = 0;
    return htmlString.replace(/<(h[1-4])([^>]*)>/gi, (full, tag, attrs) => {
        const id = `tut-${tutId}-heading-${idx}`;
        idx++;
        // 如果已有 id 属性则替换，否则新增
        if (/id\s*=/i.test(attrs)) {
            return `<${tag}${attrs.replace(/id\s*=\s*["'][^"']*["']/i, `id="${id}"`)}>`;
        }
        return `<${tag} id="${id}"${attrs}>`;
    });
}

export default function SecureContentLoader() {
    const [cdk, setCdk] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [verified, setVerified] = useState(false);
    const [payload, setPayload] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [expandedTutorials, setExpandedTutorials] = useState({});
    const containerRef = useRef(null);
    const cdkRef = useRef('');           // 保留 CDK 码用于刷新
    const refreshingRef = useRef(false); // 防并发刷新

    // ── 图片灯箱 ──
    const [lightboxSrc, setLightboxSrc] = useState(null);

    // ──── 刷新 TOTP（不增加使用计数）────
    const handleRefreshTotp = useCallback(async () => {
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        try {
            const res = await fetch(`${API_BASE}/cdk/refresh-totp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: cdkRef.current })
            });
            if (res.ok) {
                const data = await res.json();
                setPayload(prev => ({ ...prev, code2fa: data.code2fa }));
                setCountdown(data.timeRemaining || 30);
            }
        } catch (err) {
            console.error('TOTP refresh error:', err);
        } finally {
            refreshingRef.current = false;
        }
    }, []);

    // ──── TOTP 倒计时 + 自动刷新 ────
    useEffect(() => {
        if (!verified || countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // 倒计时结束 → 自动刷新 TOTP
                    handleRefreshTotp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [verified, countdown, handleRefreshTotp]);

    // ──── 提交 CDK ────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cdk.trim()) { setError('请输入数字凭证'); return; }
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/cdk/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: cdk.trim() })
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || '校验失败，请检查凭证'); return; }

            cdkRef.current = cdk.trim();
            setPayload(data);
            setVerified(true);
            setCountdown(data.timeRemaining || 30);
        } catch (err) {
            console.error('CDK verify error:', err);
            setError('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    // ──── 教程折叠 ────
    const toggleTutorial = (id) => {
        setExpandedTutorials(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // ──── 教程图片双击 → 打开灯箱 ────
    const handleTutorialBodyDblClick = useCallback((e) => {
        const img = e.target.closest('img');
        if (img && img.src) {
            e.preventDefault();
            setLightboxSrc(img.src);
        }
    }, []);

    // ──── 章节导航点击 ────
    const scrollToHeading = useCallback((headingId) => {
        const el = document.getElementById(headingId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // ──── 未验证：显示 CDK 输入框 ────
    if (!verified) {
        return (
            <div className="secure-loader animate-fade-in" ref={containerRef}>
                <div className="cdk-card glass-panel">
                    <div className="cdk-header">
                        <span className="cdk-icon">🔐</span>
                        <h2>数字凭证校验</h2>
                        <p className="cdk-hint">请输入您的专属凭证码（CDK）以获取验证信息</p>
                    </div>

                    <form onSubmit={handleSubmit} className="cdk-form">
                        <div className="input-group">
                            <input
                                id="cdk-input"
                                type="text"
                                value={cdk}
                                onChange={(e) => setCdk(e.target.value)}
                                placeholder="输入凭证码，例如 POI-XXXX-XXXX"
                                autoComplete="off"
                                spellCheck="false"
                                disabled={loading}
                            />
                        </div>

                        {error && <p className="cdk-error">{error}</p>}

                        <button type="submit" className="cdk-submit-btn" disabled={loading}>
                            {loading ? (
                                <span className="btn-loading">
                                    <span className="spinner"></span> 校验中…
                                </span>
                            ) : '立即校验'}
                        </button>
                    </form>

                    <p className="cdk-footer">
                        凭证由 POI 技术社区统一发放 · 请勿泄露
                    </p>
                </div>
            </div>
        );
    }

    // ──── 已验证：动态渲染结果 ────
    const { code2fa, tutorials = [], contactBase64 } = payload;

    return (
        <div className="secure-loader secure-result animate-fade-in" ref={containerRef}>

            {/* ① 2FA 验证密钥 — 醒目展示 + 自动刷新倒计时 */}
            <div className="result-code-card glass-panel">
                <span className="result-label">2FA 验证密钥</span>
                <div className="result-code">{code2fa}</div>
                <span className="result-expire">
                    {countdown > 0
                        ? `${countdown} 秒后自动刷新`
                        : '正在刷新验证密钥…'}
                </span>
            </div>

            {/* ② 教程模块 — 全局侧边栏 + 教程正文 */}
            {tutorials.length > 0 && (() => {
                // 聚合所有展开教程的章节标题
                const globalHeadings = [];
                tutorials.forEach((tut, index) => {
                    if (!expandedTutorials[tut.id]) return;
                    const headings = extractHeadings(tut.content, tut.id);
                    if (headings.length > 0) {
                        globalHeadings.push({ tutId: tut.id, tutTitle: tut.title, tutIndex: index + 1, headings });
                    }
                });

                return (
                    <div className="tutorial-section">
                        {/* 全局章节导航侧边栏 */}
                        {globalHeadings.length > 0 && (
                            <aside className="global-chapter-sidebar">
                                <div className="global-chapter-sidebar-inner">
                                    <div className="global-chapter-title">📑 章节导航</div>
                                    {globalHeadings.map(({ tutId, tutTitle, tutIndex, headings }) => (
                                        <div key={tutId} className="global-chapter-group">
                                            <div className="global-chapter-group-label">
                                                <span className="global-tut-badge">#{tutIndex}</span>
                                                <span className="global-tut-name">{tutTitle}</span>
                                            </div>
                                            <ul className="chapter-nav-list">
                                                {headings.map((h) => (
                                                    <li
                                                        key={h.id}
                                                        className={`chapter-nav-item chapter-nav-level-${h.level}`}
                                                        onClick={() => scrollToHeading(h.id)}
                                                    >
                                                        {h.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </aside>
                        )}

                        {/* 教程列表 — 全宽 */}
                        <div className="tutorial-modules">
                            <div className="tutorial-modules-header">
                                <span>📖 使用教程</span>
                                <span className="tutorial-count">{tutorials.length} 个模块</span>
                            </div>
                            {tutorials.map((tut, index) => {
                                const isExpanded = !!expandedTutorials[tut.id];
                                const processedContent = isExpanded ? injectHeadingIds(tut.content, tut.id) : '';

                                return (
                                    <div key={tut.id} className="tutorial-module glass-panel">
                                        <button
                                            className="tutorial-toggle"
                                            onClick={() => toggleTutorial(tut.id)}
                                            aria-expanded={isExpanded}
                                        >
                                            <span className="tutorial-index">#{index + 1}</span>
                                            <span className="tutorial-title">{tut.title}</span>
                                            <span className={`toggle-arrow ${isExpanded ? 'open' : ''}`}>▼</span>
                                        </button>
                                        {isExpanded && (
                                            <div
                                                className="tutorial-body animate-fade-in"
                                                onDoubleClick={handleTutorialBodyDblClick}
                                                dangerouslySetInnerHTML={{ __html: processedContent }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* ③ 客服微信浮窗 */}
            {contactBase64 && (
                <ContactObfuscator encodedData={contactBase64} />
            )}

            {/* ④ 图片灯箱 */}
            {lightboxSrc && (
                <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
            )}
        </div>
    );
}
