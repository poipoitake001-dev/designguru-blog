import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings, uploadMediaFile } from '../../services/api';
import './AdminForms.css';

export default function SiteSettings() {
    const [formData, setFormData] = useState({
        site_name: '',
        hero_title: '',
        hero_subtitle: '',
        logo_url: ''
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchSettings()
            .then(({ data }) => {
                setFormData({
                    site_name: data.site_name || '',
                    hero_title: data.hero_title || '',
                    hero_subtitle: data.hero_subtitle || '',
                    logo_url: data.logo_url || ''
                });
            })
            .catch(err => console.error(err));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setSaved(false);
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const res = await uploadMediaFile(file);
            setFormData(prev => ({ ...prev, logo_url: res.url }));
            setSaved(false);
        } catch (err) {
            alert('Logo 上传失败');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSettings(formData);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-form-page animate-fade-in">
            <div className="form-page-header">
                <h2>站点设置</h2>
                <p className="form-page-desc">更改网站名称、Logo、首页标题和副标题</p>
            </div>

            <div className="form-card glass-panel">
                <div className="form-section">
                    <h3>品牌信息</h3>

                    <div className="form-group">
                        <label>网站名称</label>
                        <input
                            name="site_name"
                            value={formData.site_name}
                            onChange={handleChange}
                            placeholder="例如：DesignGuru"
                        />
                        <span className="form-hint">显示在导航栏左上角的站点标题</span>
                    </div>

                    <div className="form-group">
                        <label>Logo 图片</label>
                        <div className="logo-upload-area">
                            {formData.logo_url && (
                                <div className="logo-preview">
                                    <img src={formData.logo_url} alt="Logo 预览" />
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} />
                            <span className="form-hint">或者直接输入图片地址：</span>
                            <input
                                name="logo_url"
                                value={formData.logo_url}
                                onChange={handleChange}
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>首页展示</h3>

                    <div className="form-group">
                        <label>首页大标题</label>
                        <input
                            name="hero_title"
                            value={formData.hero_title}
                            onChange={handleChange}
                            placeholder="探索 设计与代码的边界"
                        />
                        <span className="form-hint">第一个单词（空格前）将以蓝色渐变高亮展示</span>
                    </div>

                    <div className="form-group">
                        <label>首页副标题</label>
                        <textarea
                            name="hero_subtitle"
                            value={formData.hero_subtitle}
                            onChange={handleChange}
                            placeholder="分享最新的前端技术..."
                            rows={3}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
                    </button>
                </div>
            </div>
        </div>
    );
}
