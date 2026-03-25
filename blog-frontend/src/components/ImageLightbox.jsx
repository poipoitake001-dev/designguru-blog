import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ImageLightbox.css';

/**
 * ImageLightbox — 全屏图片灯箱组件
 * 双击教程图片后弹出，支持 ESC / 点击遮罩关闭
 */
export default function ImageLightbox({ src, alt, onClose }) {
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [handleKeyDown]);

    if (!src) return null;

    return createPortal(
        <div className="lightbox-overlay" onClick={onClose}>
            <button className="lightbox-close" onClick={onClose} aria-label="关闭">×</button>
            <img
                className="lightbox-image"
                src={src}
                alt={alt || '放大图片'}
                onClick={(e) => e.stopPropagation()}
            />
        </div>,
        document.body
    );
}
