/**
 * ContactObfuscator — 客服微信 ID 防采集 + 点击复制组件
 *
 * 核心安全策略:
 *   1. 微信 ID 以 Base64 编码传输，不以明文出现在 HTML 源码中
 *   2. 只在 useEffect（真实 DOM 挂载后）延迟解码并动态插入，防 OCR 和爬虫正则扫描
 *   3. 无论移动端还是 PC 端，点击按钮均执行"复制微信 ID 到剪贴板"
 *   4. 移动端额外特性：延迟 1.5s + 用户交互后，底部悬浮栏显示复制按钮
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ContactObfuscator.css';

/**
 * 安全解码 Base64 字符串（支持中文 UTF-8）
 */
function safeDecode(encoded) {
    try {
        return decodeURIComponent(
            atob(encoded)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
    } catch {
        return '';
    }
}

/**
 * 判断是否为移动设备
 */
function isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

/**
 * 复制文本到剪贴板（兼容旧浏览器）
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers / insecure contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    }
}

export default function ContactObfuscator({ encodedData, encodedText }) {
    const encoded = encodedData || encodedText || '';
    const [wechatId, setWechatId] = useState('');        // 解码后的微信 ID
    const [copied, setCopied] = useState(false);
    const [showFloat, setShowFloat] = useState(false);
    const isMobile = useRef(isMobileDevice());
    const interacted = useRef(false);

    // ── Step 1: 延迟解码（防止被静态扫描） ──
    useEffect(() => {
        if (!encoded) return;

        const timer = setTimeout(() => {
            const decoded = safeDecode(encoded);
            if (decoded) setWechatId(decoded);
        }, 800);

        return () => clearTimeout(timer);
    }, [encoded]);

    // ── Step 2: 移动端 — 监听首次交互后延迟 1.5s 显示悬浮按钮 ──
    const onFirstInteraction = useCallback(() => {
        if (interacted.current) return;
        interacted.current = true;

        setTimeout(() => {
            setShowFloat(true);
        }, 1500);
    }, []);

    useEffect(() => {
        if (!isMobile.current || !wechatId) return;

        const events = ['touchstart', 'scroll', 'click'];
        events.forEach(evt =>
            window.addEventListener(evt, onFirstInteraction, { once: true, passive: true })
        );

        return () => {
            events.forEach(evt =>
                window.removeEventListener(evt, onFirstInteraction)
            );
        };
    }, [wechatId, onFirstInteraction]);

    // ── 复制操作 ──
    const handleCopy = async () => {
        const ok = await copyToClipboard(wechatId);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    // 尚未解码完成则不渲染任何可被扫描的 DOM
    if (!wechatId) return null;

    // ── 移动端渲染 ──
    if (isMobile.current) {
        return (
            <>
                {/* 页面内联按钮 */}
                <button className="contact-copy-btn" onClick={handleCopy}>
                    {copied ? '✅ 已复制微信 ID' : '📋 点击复制专属客服微信'}
                </button>

                {/* 底部悬浮栏（延迟出现） */}
                {showFloat && (
                    <div className="contact-float animate-slide-up">
                        <div className="float-inner">
                            <span className="float-disclaimer">
                                内部通道答疑 · POI 技术社区
                            </span>
                            <button className="float-btn" onClick={handleCopy}>
                                {copied ? '✅ 已复制' : '📋 复制客服微信 ID'}
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // ── PC 端渲染 ──
    return (
        <button className="contact-copy-btn" onClick={handleCopy}>
            {copied ? '✅ 微信 ID 已复制到剪贴板' : '📋 点击复制专属客服微信 ID'}
        </button>
    );
}
