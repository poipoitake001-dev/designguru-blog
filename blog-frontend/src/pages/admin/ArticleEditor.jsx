import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import { fetchTutorialDetail, createArticle, updateArticle, uploadMediaFile } from '../../services/api';
import DragDropUpload from '../../components/DragDropUpload';
import EditorOutline from '../../components/EditorOutline';
import './ArticleEditor.css';

export default function ArticleEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    // Editor instance
    const [editor, setEditor] = useState(null);
    const editorRef = useRef(null); // ref for access in editorConfig closures

    // Form State
    const [html, setHtml] = useState('<p>在此处开始编写您的优质教程...</p>');
    const [formData, setFormData] = useState({
        title: '',
        category: '前端开发',
        summary: '',
        coverImage: ''
    });
    const [saving, setSaving] = useState(false);

    // Auto-save state
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [draftNotice, setDraftNotice] = useState(false);
    const saveTimerRef = useRef(null);

    const DRAFT_KEY = `article-draft-${id || 'new'}`;

    // Helper: upload a file and insert as image node into the editor
    const uploadAndInsertImage = useCallback(async (editorInstance, file) => {
        if (!file || !file.type.startsWith('image/')) return;
        try {
            const res = await uploadMediaFile(file);
            const imageNode = {
                type: 'image',
                src: res.url,
                alt: res.alt || file.name || 'image',
                href: res.url,
                children: [{ text: '' }],
            };
            editorInstance.restoreSelection();
            editorInstance.insertNode(imageNode);
        } catch (e) {
            console.error('Image upload failed', e);
            alert(`图片上传失败: ${e.message}`);
        }
    }, []);

    // WangEditor Config
    const toolbarConfig = {};
    const editorConfig = {
        placeholder: '请输入内容...',

        // Intercept paste: handle pasted images manually to avoid broken dangerouslyInsertNode
        customPaste: (editor, event) => {
            const items = event.clipboardData?.items;
            if (items) {
                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file) uploadAndInsertImage(editor, file);
                        return false; // prevent WangEditor default paste
                    }
                }
            }
            return true; // let WangEditor handle non-image pastes normally
        },

        MENU_CONF: {
            uploadImage: {
                // Handles toolbar upload AND paste/drop that bypass customPaste
                customUpload: async (file, insertFn) => {
                    try {
                        const res = await uploadMediaFile(file);
                        // Try insertFn first; it may crash on React 19 (dangerouslyInsertNode)
                        try {
                            insertFn(res.url, res.alt || file.name || 'image', res.url);
                        } catch (insertErr) {
                            console.warn('insertFn failed, using fallback insertNode:', insertErr.message);
                            // Fallback: use editor.insertNode() which bypasses broken Slate API
                            const ed = editorRef.current;
                            if (ed) {
                                const imageNode = {
                                    type: 'image',
                                    src: res.url,
                                    alt: res.alt || file.name || 'image',
                                    href: res.url,
                                    children: [{ text: '' }],
                                };
                                ed.restoreSelection();
                                ed.insertNode(imageNode);
                            }
                        }
                    } catch (e) {
                        console.error('Image upload failed', e);
                        alert(`图片上传失败: ${e.message}`);
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
                        alert(`视频上传失败: ${e.message}`);
                    }
                }
            }
        },
    };

    const handleEditorCreated = useCallback((editorInstance) => {
        setEditor(editorInstance);
        editorRef.current = editorInstance;

        // Attach custom drop handler on the editor DOM to intercept dragged images
        const editorEl = editorInstance.getEditableContainer?.();
        if (editorEl) {
            const handleDrop = (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    for (const file of files) {
                        if (file.type.startsWith('image/')) {
                            e.preventDefault();
                            e.stopPropagation();
                            uploadAndInsertImage(editorInstance, file);
                            return;
                        }
                    }
                }
            };
            editorEl.addEventListener('drop', handleDrop, true); // capture phase
            // Store cleanup ref
            editorInstance._customDropHandler = handleDrop;
            editorInstance._customDropEl = editorEl;
        }
    }, [uploadAndInsertImage]);

    // Load article data or restore draft
    useEffect(() => {
        // Check for saved draft first
        try {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (draft) {
                const parsed = JSON.parse(draft);
                setFormData(parsed.formData);
                setHtml(parsed.html);
                setDraftNotice(true);
                setTimeout(() => setDraftNotice(false), 4000);
                return; // use draft instead of fetching
            }
        } catch (e) { /* ignore parse errors */ }

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
    }, [id, isEdit, DRAFT_KEY]);

    // Debounced auto-save to localStorage
    useEffect(() => {
        if (!isDirty) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            try {
                const draft = JSON.stringify({ html, formData, savedAt: Date.now() });
                localStorage.setItem(DRAFT_KEY, draft);
                setLastSaved(new Date());
                setIsDirty(false);
            } catch (e) {
                console.warn('Auto-save failed:', e);
            }
        }, 2000);
        return () => clearTimeout(saveTimerRef.current);
    }, [isDirty, html, formData, DRAFT_KEY]);

    // Mark dirty on content/form changes
    const handleHtmlChange = useCallback((editorInstance) => {
        setHtml(editorInstance.getHtml());
        setIsDirty(true);
    }, []);

    // Warn before browser tab close
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (isDirty) {
                // Auto-save before closing
                try {
                    const draft = JSON.stringify({ html, formData, savedAt: Date.now() });
                    localStorage.setItem(DRAFT_KEY, draft);
                } catch (err) { /* ignore */ }
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isDirty, html, formData, DRAFT_KEY]);

    // Auto-save draft when component unmounts (navigating away within app)
    useEffect(() => {
        return () => {
            // Save current state on unmount
            try {
                const currentHtml = document.querySelector('.w-e-text-container')?.innerHTML;
                const draft = JSON.stringify({ html, formData, savedAt: Date.now() });
                localStorage.setItem(DRAFT_KEY, draft);
            } catch (err) { /* ignore */ }
        };
    }, [html, formData, DRAFT_KEY]);

    // Clean up editor instance on unmount
    useEffect(() => {
        return () => {
            if (editor == null) return;
            // Clean up custom drop handler
            if (editor._customDropEl && editor._customDropHandler) {
                editor._customDropEl.removeEventListener('drop', editor._customDropHandler, true);
            }
            editor.destroy();
            setEditor(null);
        };
    }, [editor]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
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
            // Clean up draft after successful save
            localStorage.removeItem(DRAFT_KEY);
            setIsDirty(false);
            justSavedRef.current = true;
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
            {draftNotice && (
                <div className="draft-restored-notice">
                    📋 已恢复上次编辑的草稿内容
                </div>
            )}
            <div className="editor-header">
                <h2>{isEdit ? '编辑教程' : '发布新教程'}</h2>
                <div className="header-actions">
                    {lastSaved && (
                        <span className="autosave-indicator">
                            ✓ 已自动保存 {lastSaved.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button className="cancel-btn" onClick={() => navigate('/admin/articles')}>取消</button>
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '发布文章'}
                    </button>
                </div>
            </div>

            <div className="editor-layout">
                {/* Left: Chapter Outline */}
                <EditorOutline editor={editor} html={html} />

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
                            onCreated={handleEditorCreated}
                            onChange={handleHtmlChange}
                            mode="default"
                            style={{ height: '500px', overflowY: 'hidden' }}
                        />
                    </div>
                </div>

                <div className="editor-sidebar glass-panel">
                    <h3>文章设置</h3>

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
                        <label>封面配图</label>
                        <DragDropUpload
                            value={formData.coverImage}
                            onChange={(url) => setFormData(prev => ({ ...prev, coverImage: url }))}
                            placeholder="支持 JPG、PNG、GIF、WebP 格式"
                        />
                        <span className="form-hint" style={{ marginTop: '0.5rem', display: 'block' }}>或直接输入图片链接：</span>
                        <input
                            name="coverImage"
                            value={formData.coverImage}
                            onChange={handleChange}
                            placeholder="https://example.com/cover.jpg"
                        />
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
