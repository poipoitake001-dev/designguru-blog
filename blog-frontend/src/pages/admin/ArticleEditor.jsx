import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import { fetchTutorialDetail, createArticle, updateArticle, uploadMediaFile } from '../../services/api';
import './ArticleEditor.css';

export default function ArticleEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    // Editor instance
    const [editor, setEditor] = useState(null);

    // Form State
    const [html, setHtml] = useState('<p>在此处开始编写您的优质教程...</p>');
    const [formData, setFormData] = useState({
        title: '',
        category: '前端开发',
        summary: '',
        coverImage: ''
    });
    const [saving, setSaving] = useState(false);

    // WangEditor Config
    const toolbarConfig = {};
    const editorConfig = {
        placeholder: '请输入内容...',
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
            },
            uploadVideo: {
                customUpload: async (file, insertFn) => {
                    try {
                        const res = await uploadMediaFile(file);
                        insertFn(res.url, res.url);
                    } catch (e) {
                        console.error('Video upload failed', e);
                    }
                }
            }
        }
    };

    useEffect(() => {
        if (isEdit) {
            fetchTutorialDetail(id).then(({ data }) => {
                setFormData({
                    title: data.title || '',
                    category: data.category || '前端开发',
                    summary: data.summary || '',
                    coverImage: data.coverImage || ''
                });
                setHtml(data.content || '');
            }).catch(err => {
                console.error('Failed to load article:', err);
            });
        }
    }, [id, isEdit]);

    // Clean up editor instance on unmount
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
    };

    const handleSave = async () => {
        if (!formData.title) return alert('标题不能为空');
        setSaving(true);

        const payload = { ...formData, content: html };

        try {
            if (isEdit) {
                await updateArticle(id, payload);
            } else {
                await createArticle(payload);
            }
            navigate('/admin/articles');
        } catch (e) {
            console.error(e);
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="article-editor-page animate-fade-in">
            <div className="editor-header">
                <h2>{isEdit ? '编辑教程' : '发布新教程'}</h2>
                <div className="header-actions">
                    <button className="cancel-btn" onClick={() => navigate('/admin/articles')}>取消</button>
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '发布文章'}
                    </button>
                </div>
            </div>

            <div className="editor-layout">
                <div className="editor-main glass-panel">
                    <div className="form-group">
                        <input
                            className="title-input"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="在这里输入炫酷的标题..."
                            autoComplete="off"
                        />
                    </div>

                    <div className="wangeditor-wrapper">
                        <Toolbar
                            editor={editor}
                            defaultConfig={toolbarConfig}
                            mode="default"
                            style={{ borderBottom: '1px solid var(--border-color)' }}
                        />
                        <Editor
                            defaultConfig={editorConfig}
                            value={html}
                            onCreated={setEditor}
                            onChange={editor => setHtml(editor.getHtml())}
                            mode="default"
                            style={{ height: '500px', overflowY: 'hidden' }}
                        />
                    </div>
                </div>

                <div className="editor-sidebar glass-panel">
                    <h3>基础设置</h3>

                    <div className="form-group">
                        <label>分类</label>
                        <select name="category" value={formData.category} onChange={handleChange}>
                            <option value="UI/UX 设计">UI/UX 设计</option>
                            <option value="前端开发">前端开发</option>
                            <option value="全栈实践">全栈实践</option>
                            <option value="设计系统">设计系统</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>封面配图 (URL)</label>
                        <input
                            name="coverImage"
                            value={formData.coverImage}
                            onChange={handleChange}
                            placeholder="输入图片链接..."
                        />
                        {formData.coverImage && (
                            <div className="cover-preview">
                                <img src={formData.coverImage} alt="封面预览" />
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>教程摘要</label>
                        <textarea
                            name="summary"
                            value={formData.summary}
                            onChange={handleChange}
                            placeholder="简要描述这篇教程的核心内容..."
                            rows={5}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
