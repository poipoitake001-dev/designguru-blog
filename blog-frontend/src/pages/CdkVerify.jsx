/**
 * CdkVerify — CDK 凭证验证着陆页
 *
 * 完整交互流程：
 * 1. 用户输入 CDK 凭证 → POST /api/cdk/verify
 * 2. 成功后：动态销毁输入表单，原位渲染 TOTP 六位码 + 教程
 * 3. 教程末尾解码 Base64 渲染"复制客服微信 ID"按钮
 * 4. UA 判断：
 *    - 移动端 → 1.5s 延迟出现底部悬浮按钮
 *    - PC 端 → 显示二维码模态框入口
 */

import React, { useState, useEffect, useRef } from 'react';
import { verifyCdk } from '../services/api';
import ContactObfuscator from '../components/ContactObfuscator';
import './CdkVerify.css';

// ── 设备判断 ──
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export default function CdkVerify() {
  // ── 状态 ──
  const [cdkInput, setCdkInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);       // { code2fa, timeRemaining, tutorial, contactBase64 }
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [showFloat, setShowFloat] = useState(false); // 移动端悬浮按钮
  const [showQrModal, setShowQrModal] = useState(false); // PC 端二维码模态框
  const [countdown, setCountdown] = useState(0);     // TOTP 倒计时
  const [copied, setCopied] = useState(false);

  const resultRef = useRef(null);
  const isMobile = isMobileDevice();

  // ── TOTP 倒计时 ──
  useEffect(() => {
    if (!result) return;
    setCountdown(result.timeRemaining);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [result]);

  // ── 移动端延迟渲染悬浮按钮 ──
  useEffect(() => {
    if (!result || !isMobile) return;
    const timer = setTimeout(() => setShowFloat(true), 1500);
    return () => clearTimeout(timer);
  }, [result, isMobile]);

  // ── 提交 CDK ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cdkInput.trim()) {
      setError('请输入 CDK 凭证');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await verifyCdk(cdkInput.trim());
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── 解码联系方式并复制 ──
  const handleCopyContact = async () => {
    if (!result?.contactBase64) return;
    try {
      const decoded = atob(result.contactBase64);
      await navigator.clipboard.writeText(decoded);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = atob(result.contactBase64);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── 倒计时进度百分比 ──
  const countdownPercent = result ? (countdown / 30) * 100 : 0;

  // ════════════════════════════════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="cdk-page">
      <div className="cdk-container">
        {/* ─── 页头 ─── */}
        <header className="cdk-header">
          <div className="cdk-header__icon">🔐</div>
          <h1 className="cdk-header__title">POI 技术社区</h1>
          <p className="cdk-header__subtitle">数字资产交付 · 凭证验证系统</p>
        </header>

        {/* ─── CDK 输入表单（验证成功后销毁）─── */}
        {!result && (
          <form className="cdk-form" onSubmit={handleSubmit}>
            <div className="cdk-form__input-group">
              <input
                id="cdk-input"
                type="text"
                className="cdk-form__input"
                placeholder="请输入您的 CDK 凭证"
                value={cdkInput}
                onChange={(e) => setCdkInput(e.target.value)}
                disabled={loading}
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
              <button
                id="cdk-submit"
                type="submit"
                className="cdk-form__btn"
                disabled={loading || !cdkInput.trim()}
              >
                {loading ? (
                  <span className="cdk-form__spinner" />
                ) : (
                  '验证'
                )}
              </button>
            </div>
            {error && (
              <div className="cdk-form__error" role="alert">
                <span className="cdk-form__error-icon">⚠</span>
                {error}
              </div>
            )}
          </form>
        )}

        {/* ─── 验证结果区域（动态渲染）─── */}
        {result && (
          <div className="cdk-result" ref={resultRef}>
            {/* TOTP 六位码 + 倒计时 */}
            <div className="cdk-result__code-card">
              <div className="cdk-result__code-label">您的验证码</div>
              <div className="cdk-result__code-digits" id="totp-display">
                {result.code2fa.split('').map((digit, i) => (
                  <span key={i} className="cdk-result__digit">{digit}</span>
                ))}
              </div>
              <div className="cdk-result__countdown">
                <div
                  className="cdk-result__countdown-bar"
                  style={{ width: `${countdownPercent}%` }}
                />
                <span className="cdk-result__countdown-text">
                  {countdown > 0
                    ? `${countdown}s 后刷新`
                    : '验证码已过期，请重新验证'}
                </span>
              </div>
            </div>

            {/* 教程区域（折叠/展开）*/}
            {result.tutorial && (
              <div className="cdk-result__tutorial">
                <button
                  className="cdk-result__tutorial-toggle"
                  onClick={() => setTutorialOpen(!tutorialOpen)}
                  type="button"
                >
                  <span>📖 使用教程</span>
                  <span className={`cdk-result__tutorial-arrow ${tutorialOpen ? 'cdk-result__tutorial-arrow--open' : ''}`}>
                    ▼
                  </span>
                </button>
                {tutorialOpen && (
                  <div
                    className="cdk-result__tutorial-content"
                    dangerouslySetInnerHTML={{ __html: result.tutorial }}
                  />
                )}
              </div>
            )}

            {/* 客服联系按钮 */}
            {result.contactBase64 && (
              <div className="cdk-result__contact">
                <ContactObfuscator
                  encodedText={result.contactBase64}
                  label="📋 点击复制客服微信 ID"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 移动端：底部悬浮按钮（延迟 1.5s 出现）─── */}
      {result && isMobile && showFloat && result.contactBase64 && (
        <div className="cdk-float-btn" onClick={handleCopyContact}>
          <span>{copied ? '✓ 已复制微信 ID' : '📋 复制客服微信 ID'}</span>
        </div>
      )}

      {/* ─── PC 端：二维码模态框触发按钮 ─── */}
      {result && !isMobile && result.contactBase64 && (
        <>
          <button
            className="cdk-qr-trigger"
            onClick={() => setShowQrModal(true)}
            type="button"
          >
            💬 联系客服
          </button>

          {showQrModal && (
            <div className="cdk-modal-overlay" onClick={() => setShowQrModal(false)}>
              <div className="cdk-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="cdk-modal__close"
                  onClick={() => setShowQrModal(false)}
                  type="button"
                >
                  ✕
                </button>
                <h3 className="cdk-modal__title">添加客服微信</h3>
                <p className="cdk-modal__desc">复制下方微信 ID，添加好友获取技术支持</p>
                <ContactObfuscator
                  encodedText={result.contactBase64}
                  label="📋 点击复制微信 ID"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
