/**
 * ContactObfuscator — 联系方式防采集组件
 *
 * 原理：将客服微信 ID 以 Base64 编码写死在 JS 中，
 * 页面加载后通过 useEffect 解码并动态插入 DOM，
 * 爬虫静态抓取 HTML 源码无法获取明文。
 *
 * 用法：
 *   <ContactObfuscator
 *     encodedText="d3hpZF8xMjM0NTY="   // btoa('wxid_123456')
 *     label="添加客服微信获取技术支持"
 *   />
 */

import React, { useEffect, useRef, useState } from 'react';

export default function ContactObfuscator({ encodedText, label = '点击复制客服微信' }) {
  const containerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !encodedText) return;

    // ── 解码 Base64 ──
    let decoded;
    try {
      decoded = atob(encodedText);
    } catch {
      console.warn('[ContactObfuscator] Base64 decode failed');
      return;
    }

    // ── 动态构建 DOM 元素（而非直接写入 innerHTML）──
    const wrapper = document.createElement('div');
    wrapper.className = 'contact-obfuscated';

    const textSpan = document.createElement('span');
    textSpan.className = 'contact-obfuscated__id';
    textSpan.textContent = decoded;

    wrapper.appendChild(textSpan);

    // 清空容器并插入
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(wrapper);

    // 防止右键复制源码（轻度防护）
    wrapper.addEventListener('contextmenu', (e) => e.preventDefault());
  }, [encodedText]);

  // ── 复制到剪贴板 ──
  const handleCopy = async () => {
    try {
      const decoded = atob(encodedText);
      await navigator.clipboard.writeText(decoded);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = atob(encodedText);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="contact-obfuscator">
      {/* 解码后的微信 ID 会被动态注入到这里 */}
      <div ref={containerRef} className="contact-obfuscator__slot" />
      <button
        className={`contact-obfuscator__btn ${copied ? 'contact-obfuscator__btn--copied' : ''}`}
        onClick={handleCopy}
        type="button"
      >
        {copied ? '✓ 已复制' : label}
      </button>
    </div>
  );
}
