import React, { useState, useEffect, useCallback } from 'react';
import { fetchSettings, updateSettings } from '../../services/api';
import './AdminForms.css';

const DEFAULT_NAV_ITEMS = [
    { label: '所有教程', path: '/' },
    { label: '关于作者', path: '/about' }
];

export default function NavEditor() {
    const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);

    useEffect(() => {
        fetchSettings()
            .then(({ data }) => {
                if (data.nav_items) {
                    try {
                        const parsed = JSON.parse(data.nav_items);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setNavItems(parsed);
                        }
                    } catch (e) {
                        console.error('Failed to parse nav_items:', e);
                    }
                }
            })
            .catch(err => console.error(err));
    }, []);

    const handleItemChange = (index, field, value) => {
        setNavItems(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
        setSaved(false);
    };

    const addItem = () => {
        setNavItems(prev => [...prev, { label: '', path: '/' }]);
        setSaved(false);
    };

    const removeItem = (index) => {
        if (navItems.length <= 1) return alert('至少保留一个导航项');
        setNavItems(prev => prev.filter((_, i) => i !== index));
        setSaved(false);
    };

    // Drag-and-drop reorder
    const handleDragStart = (index) => {
        setDragIndex(index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        setNavItems(prev => {
            const items = [...prev];
            const [dragged] = items.splice(dragIndex, 1);
            items.splice(index, 0, dragged);
            return items;
        });
        setDragIndex(index);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setSaved(false);
    };

    const handleSave = useCallback(async () => {
        // Validate
        for (const item of navItems) {
            if (!item.label.trim()) return alert('导航名称不能为空');
            if (!item.path.trim()) return alert('导航路径不能为空');
        }

        setSaving(true);
        try {
            await updateSettings({ nav_items: JSON.stringify(navItems) });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    }, [navItems]);

    return (
        <div className="admin-form-page animate-fade-in">
            <div className="form-page-header">
                <h2>导航管理</h2>
                <p className="form-page-desc">编辑前端导航栏的菜单项，支持拖拽排序</p>
            </div>

            <div className="form-card glass-panel">
                <div className="form-section">
                    <h3>导航菜单项</h3>

                    <div className="nav-editor-list">
                        {navItems.map((item, index) => (
                            <div
                                key={index}
                                className={`nav-editor-item ${dragIndex === index ? 'dragging' : ''}`}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                <span className="nav-drag-handle" title="拖拽排序">⠿</span>

                                <div className="nav-editor-fields">
                                    <div className="form-group">
                                        <label>显示名称</label>
                                        <input
                                            value={item.label}
                                            onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                                            placeholder="如：所有教程"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>路由路径</label>
                                        <input
                                            value={item.path}
                                            onChange={(e) => handleItemChange(index, 'path', e.target.value)}
                                            placeholder="如：/"
                                        />
                                    </div>
                                </div>

                                <button
                                    className="nav-remove-btn"
                                    onClick={() => removeItem(index)}
                                    title="删除"
                                >✕</button>
                            </div>
                        ))}
                    </div>

                    <button className="nav-add-btn" onClick={addItem}>
                        ＋ 添加导航项
                    </button>
                </div>

                <div className="form-actions">
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : saved ? '✓ 已保存' : '保存导航'}
                    </button>
                </div>
            </div>
        </div>
    );
}
