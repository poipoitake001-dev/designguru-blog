/**
 * ContactObfuscator — 客服微信 ID 防采集 + "立即咨询" 浮窗卡片组件
 *
 * 核心安全策略:
 *   1. 微信 ID 以 Base64 编码传输，不以明文出现在 HTML 源码中
 *   2. 只在 useEffect（真实 DOM 挂载后）延迟解码并动态插入，防 OCR 和爬虫正则扫描
 *   3. 点击 "立即咨询" 按钮执行 "复制微信 ID 到剪贴板"
 *   4. 移动端延迟 1.5s + 用户交互后显示卡片
 *
 * UI 参考: Easy Gemini 深色悬浮客服卡片
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ContactObfuscator.css';

/** 安全解码 Base64 字符串（支持中文 UTF-8） */
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

/** 判断是否为移动设备 */
function isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

/** 复制文本到剪贴板（兼容旧浏览器） */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
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
    const [wechatId, setWechatId] = useState('');
    const [copied, setCopied] = useState(false);
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
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

    // ── Step 2: PC 端 — 解码完成后直接显示卡片 ──
    useEffect(() => {
        if (!isMobile.current && wechatId) {
            const timer = setTimeout(() => setVisible(true), 500);
            return () => clearTimeout(timer);
        }
    }, [wechatId]);

    // ── Step 3: 移动端 — 监听首次交互后延迟 1.5s 显示 ──
    const onFirstInteraction = useCallback(() => {
        if (interacted.current) return;
        interacted.current = true;
        setTimeout(() => setVisible(true), 1500);
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

    // ── 关闭卡片 ──
    const handleDismiss = () => {
        setDismissed(true);
    };

    // 尚未解码或已关闭则不渲染
    if (!wechatId || dismissed || !visible) return null;

    const card = (
        <div className={`contact-card-toast ${isMobile.current ? 'mobile' : 'desktop'} animate-card-in`}>
            {/* 关闭按钮 */}
            <button className="card-close-btn" onClick={handleDismiss} aria-label="关闭">
                ×
            </button>

            {/* 标题区 */}
            <div className="card-header">
                <span className="wechat-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="#07c160">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.08 6.08 0 0 1-.235-1.653c0-3.526 3.235-6.39 7.233-6.39.247 0 .49.013.731.034C16.498 4.796 12.89 2.188 8.691 2.188zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm4.687 4.282c-3.424 0-6.206 2.46-6.206 5.492 0 3.034 2.782 5.494 6.206 5.494a7.27 7.27 0 0 0 2.16-.327.63.63 0 0 1 .525.074l1.4.82a.235.235 0 0 0 .122.039c.117 0 .214-.095.214-.213a.177.177 0 0 0-.035-.156l-.287-1.093a.434.434 0 0 1 .156-.49C22.924 18.652 24 16.9 24 14.963c0-3.031-2.782-5.49-6.206-5.49h-.51zm-2.143 2.674c.47 0 .852.387.852.864a.858.858 0 0 1-.852.864.858.858 0 0 1-.853-.864c0-.477.382-.864.853-.864zm4.285 0c.47 0 .853.387.853.864a.858.858 0 0 1-.853.864.858.858 0 0 1-.852-.864c0-.477.382-.864.852-.864z"/>
                    </svg>
                </span>
                <span className="card-title">联系客服</span>
            </div>

            {/* 说明文本 */}
            <p className="card-desc">
                有问题直接联系企业微信技术专员，<br/>
                淘宝售前不负责解答产品问题
            </p>

            {/* CTA 按钮 */}
            <button className="consult-btn" onClick={handleCopy}>
                {copied ? '✅ 微信号已复制，去微信添加' : '立即咨询  →'}
            </button>
        </div>
    );

    // 使用 Portal 渲染到 body，避免被父容器 overflow 或 z-index 限制
    return createPortal(card, document.body);
}
