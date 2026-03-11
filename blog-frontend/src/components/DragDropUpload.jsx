import React, { useState, useRef, useCallback } from 'react';
import { uploadMediaFile } from '../services/api';
import './DragDropUpload.css';

/**
 * Reusable drag-and-drop image upload component.
 *
 * Props:
 *   value       - current image URL (for preview)
 *   onChange     - callback(url) when a new image is uploaded
 *   placeholder - custom placeholder text
 */
export default function DragDropUpload({ value, onChange, placeholder }) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const dragCounter = useRef(0);

    const handleUpload = useCallback(async (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setUploading(true);
        try {
            const res = await uploadMediaFile(file);
            onChange(res.url);
        } catch (err) {
            console.error('Upload failed:', err);
            alert('图片上传失败');
        } finally {
            setUploading(false);
        }
    }, [onChange]);

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        setDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) setDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        dragCounter.current = 0;
        const file = e.dataTransfer.files?.[0];
        handleUpload(file);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        // Reset input so the same file can be selected again
        e.target.value = '';
    };

    const hasPreview = Boolean(value) && !uploading;

    return (
        <div
            className={`drag-drop-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''} ${hasPreview ? 'has-preview' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
            />

            {uploading ? (
                <>
                    <div className="drag-drop-spinner" />
                    <span className="drag-drop-text">上传中...</span>
                </>
            ) : hasPreview ? (
                <div className="drag-drop-preview">
                    <img src={value} alt="预览" />
                    <div className="drag-drop-preview-overlay">
                        📷 点击或拖拽替换图片
                    </div>
                </div>
            ) : (
                <>
                    <div className="drag-drop-icon">📁</div>
                    <span className="drag-drop-text">
                        拖拽图片到此处，或 <strong>点击上传</strong>
                    </span>
                    <span className="drag-drop-hint">{placeholder || '支持 JPG、PNG、GIF、WebP 格式'}</span>
                </>
            )}
        </div>
    );
}
