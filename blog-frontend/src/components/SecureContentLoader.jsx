/**
 * SecureContentLoader — CDK 凭证校验 + 动态渲染验证码与教程
 *
 * 流程:
 *   1. 用户在输入框中输入 CDK（数字凭证）
 *   2. 前端 POST 到后端 /api/cdk/verify（后端本地 TOTP 生成，无外部请求）
 *   3. 后端校验 CDK → 使用 otplib 本地生成 6 位验证码 → 返回 JSON
 *   4. 前端销毁输入框，原位动态渲染 2FA 验证码、折叠教程、客服微信复制按钮
 */

import React, { useState, useEffect, useRef } from 'react';
import ContactObfuscator from './ContactObfuscator';
import './SecureContentLoader.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function SecureContentLoader() {
    // ──── 状态 ────
    const [cdk, setCdk] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [verified, setVerified] = useState(false);
    const [payload, setPayload] = useState(null);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const containerRef = useRef(null);

    // ──── TOTP 倒计时 ────
    useEffect(() => {
        if (!verified || countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [verified, countdown]);

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

            if (!res.ok) {
                setError(data.error || '校验失败，请检查凭证');
                return;
            }

            // 校验成功 → 切换到渲染模式
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

                        <button
                            type="submit"
                            className="cdk-submit-btn"
                            disabled={loading}
                        >
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
    const { code2fa, tutorial, contactBase64 } = payload;

    return (
        <div className="secure-loader secure-result animate-fade-in" ref={containerRef}>

            {/* ① 2FA 验证码 — 醒目展示 + 倒计时 */}
            <div className="result-code-card glass-panel">
                <span className="result-label">您的 2FA 验证码</span>
                <div className="result-code">{code2fa}</div>
                <span className="result-expire">
                    {countdown > 0
                        ? `${countdown} 秒后刷新，请尽快使用`
                        : '验证码可能已过期，请重新校验'}
                </span>
            </div>

            {/* ② 折叠/展开 教程区域 */}
            {tutorial && (
                <div className="result-tutorial glass-panel">
                    <button
                        className="tutorial-toggle"
                        onClick={() => setTutorialOpen(!tutorialOpen)}
                        aria-expanded={tutorialOpen}
                    >
                        <span>📖 使用教程</span>
                        <span className={`toggle-arrow ${tutorialOpen ? 'open' : ''}`}>▼</span>
                    </button>
                    {tutorialOpen && (
                        <div className="tutorial-body animate-fade-in">
                            <div dangerouslySetInnerHTML={{ __html: tutorial }} />
                        </div>
                    )}
                </div>
            )}

            {/* ③ 客服微信（Base64 解码 → 点击复制微信 ID，含设备自适应） */}
            {contactBase64 && (
                <ContactObfuscator encodedData={contactBase64} />
            )}
        </div>
    );
}
