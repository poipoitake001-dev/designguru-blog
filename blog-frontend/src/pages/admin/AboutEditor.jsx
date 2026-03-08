import React, { useState, useEffect } from 'react';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import { fetchAbout, updateAbout, uploadMediaFile } from '../../services/api';
import './AdminForms.css';

export default function AboutEditor() {
    const [editor, setEditor] = useState(null);
    const [html, setHtml] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        avatar: '',
        bio: '',
        email: '',
        github: '',
        twitter: ''
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const toolbarConfig = {};
    const editorConfig = {
        placeholder: '在这里详细介绍你自己...',
        MENU_CONF: {
            uploadImage: {
                customUpload: async (file, insertFn) => {
                    try {
                        const res = await uploadMediaFile(file);
                        insertFn(res.url, res.alt, res.url);
                    } catch (e) {
                        console.error('Image upload failed', e);
                    }
                }
            }
        }
    };

    useEffect(() => {
        fetchAbout()
            .then(({ data }) => {
                setFormData({
                    name: data.name || '',
                    avatar: data.avatar || '',
                    bio: data.bio || '',
                    email: data.email || '',
                    github: data.github || '',
                    twitter: data.twitter || ''
                });
                setHtml(data.content || '');
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        return () => {
            if (editor == null) return;
            editor.destroy();
            setEditor(null);
        };
    }, [editor]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setSaved(false);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const res = await uploadMediaFile(file);
            setFormData(prev => ({ ...prev, avatar: res.url }));
            setSaved(false);
        } catch (err) {
            alert('头像上传失败');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateAbout({ ...formData, content: html });
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
                <h2>关于作者</h2>
                <p className="form-page-desc">编辑「关于作者」页面展示的个人信息和介绍</p>
            </div>

            <div className="form-card glass-panel">
                <div className="form-section">
                    <h3>基本信息</h3>

                    <div className="form-group">
                        <label>作者名称</label>
                        <input name="name" value={formData.name} onChange={handleChange} placeholder="你的笔名" />
                    </div>

                    <div className="form-group">
                        <label>头像</label>
                        <div className="logo-upload-area">
                            {formData.avatar && (
                                <div className="avatar-preview">
                                    <img src={formData.avatar} alt="头像预览" />
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                            <span className="form-hint">或直接粘贴图片地址：</span>
                            <input name="avatar" value={formData.avatar} onChange={handleChange} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>一句话简介</label>
                        <input name="bio" value={formData.bio} onChange={handleChange} placeholder="资深 UI/UX 设计师..." />
                        <span className="form-hint">会显示在教程详情页的侧边栏和关于页面中</span>
                    </div>
                </div>

                <div className="form-section">
                    <h3>社交链接</h3>

                    <div className="form-group">
                        <label>Email</label>
                        <input name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" />
                    </div>

                    <div className="form-group">
                        <label>GitHub</label>
                        <input name="github" value={formData.github} onChange={handleChange} placeholder="https://github.com/..." />
                    </div>

                    <div className="form-group">
                        <label>Twitter / X</label>
                        <input name="twitter" value={formData.twitter} onChange={handleChange} placeholder="https://x.com/..." />
                    </div>
                </div>

                <div className="form-section">
                    <h3>详细介绍（富文本）</h3>
                    <div className="editor-box glass-panel">
                        <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" style={{ borderBottom: '1px solid var(--border-color)' }} />
                        <Editor
                            defaultConfig={editorConfig}
                            value={html}
                            onCreated={setEditor}
                            onChange={editor => setHtml(editor.getHtml())}
                            mode="default"
                            style={{ height: '350px', overflowY: 'hidden' }}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : saved ? '✓ 已保存' : '保存修改'}
                    </button>
                </div>
            </div>
        </div>
    );
}
