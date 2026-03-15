/**
 * SecureContentLoader — CDK 凭证校验 + 动态渲染 2FA 验证密钥与教程模块
 *
 * 流程:
 *   1. 用户输入 CDK → POST /api/cdk/verify
 *   2. 后端返回 TOTP + 绑定教程列表 + 客服微信 Base64
 *   3. 前端销毁输入框，原位渲染 2FA 密钥（自动刷新）+ 教程卡片列表 + 客服浮窗
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContactObfuscator from './ContactObfuscator';
import './SecureContentLoader.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    }, [verified, countdown]);

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

            {/* ② 教程模块列表（从数据库文章绑定而来） */}
            {tutorials.length > 0 && (
                <div className="tutorial-modules">
                    <div className="tutorial-modules-header">
                        <span>📖 使用教程</span>
                        <span className="tutorial-count">{tutorials.length} 个模块</span>
                    </div>
                    {tutorials.map((tut, index) => (
                        <div key={tut.id} className="tutorial-module glass-panel">
                            <button
                                className="tutorial-toggle"
                                onClick={() => toggleTutorial(tut.id)}
                                aria-expanded={!!expandedTutorials[tut.id]}
                            >
                                <span className="tutorial-index">#{index + 1}</span>
                                <span className="tutorial-title">{tut.title}</span>
                                <span className={`toggle-arrow ${expandedTutorials[tut.id] ? 'open' : ''}`}>▼</span>
                            </button>
                            {expandedTutorials[tut.id] && (
                                <div className="tutorial-body animate-fade-in">
                                    <div dangerouslySetInnerHTML={{ __html: tut.content }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ③ 客服微信浮窗 */}
            {contactBase64 && (
                <ContactObfuscator encodedData={contactBase64} />
            )}
        </div>
    );
}
