import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchCdks, createCdk, updateCdk, toggleCdkStatus, deleteCdk, fetchTutorials, updateCdkArticles } from '../../services/api';
import './CdkManager.css';

export default function CdkManager() {
    const [cdks, setCdks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCdkInfo, setEditingCdkInfo] = useState(null); // 正在编辑的 CDK（null = 新建模式）
    const [allArticles, setAllArticles] = useState([]);  // 所有可选教程

    // Form state
    const [code, setCode] = useState('');
    const [totpSecret, setTotpSecret] = useState('');
    const [contactBase64, setContactBase64] = useState('');
    const [maxUses, setMaxUses] = useState(0);
    const [expiresDays, setExpiresDays] = useState(0);
    const [selectedArticleIds, setSelectedArticleIds] = useState([]);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // 教程管理弹窗
    const [editingCdkId, setEditingCdkId] = useState(null);
    const [editArticleIds, setEditArticleIds] = useState([]);
    const [editLoading, setEditLoading] = useState(false);

    useEffect(() => {
        loadCdks();
        loadArticles();
    }, []);

    const loadCdks = async () => {
        try {
            setLoading(true);
            const data = await fetchCdks();
            setCdks(data);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadArticles = async () => {
        try {
            const data = await fetchTutorials();
            setAllArticles(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            console.error('Failed to load articles:', err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!code || !totpSecret) {
            setCreateError('CDK 凭据和 TOTP 密钥不能为空');
            return;
        }

        try {
            setCreateLoading(true);
            const payload = {
                code: code.trim().toUpperCase(),
                totp_secret: totpSecret.trim(),
                contact_base64: contactBase64.trim(),
                max_uses: Number(maxUses),
                expires_days: Number(expiresDays),
            };

            if (editingCdkInfo) {
                // 编辑模式
                await updateCdk(editingCdkInfo.id, payload);
            } else {
                // 新建模式
                await createCdk({ ...payload, article_ids: selectedArticleIds });
            }
            setShowCreateModal(false);
            resetForm();
            loadCdks();
        } catch (err) {
            setCreateError(err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleToggle = async (id) => {
        try {
            await toggleCdkStatus(id);
            setCdks(cdks.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
        } catch (err) {
            alert('切换状态失败: ' + err.message);
        }
    };

    const handleDelete = async (id, code) => {
        if (!window.confirm(`确认删除凭证 ${code} 吗？此操作不可恢复。`)) return;
        try {
            await deleteCdk(id);
            setCdks(cdks.filter(c => c.id !== id));
        } catch (err) {
            alert('删除凭证失败: ' + err.message);
        }
    };

    const resetForm = () => {
        setCode('');
        setTotpSecret('');
        setContactBase64('');
        setMaxUses(0);
        setExpiresDays(0);
        setSelectedArticleIds([]);
        setCreateError('');
        setEditingCdkInfo(null);
    };

    const openEditModal = (cdk) => {
        setEditingCdkInfo(cdk);
        setCode(cdk.code);
        setTotpSecret(cdk.totp_secret || '');
        setContactBase64(cdk.contact_base64 || '');
        setMaxUses(cdk.max_uses || 0);
        // 从 expires_at 倒推剩余天数
        if (cdk.expires_at) {
            const remaining = Math.max(0, Math.ceil((new Date(cdk.expires_at) - Date.now()) / 86400000));
            setExpiresDays(remaining);
        } else {
            setExpiresDays(0);
        }
        setSelectedArticleIds([]);
        setCreateError('');
        setShowCreateModal(true);
    };

    const generateRandomTotpSecret = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        for (let i = 0; i < 16; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setTotpSecret(secret);
    };

    const generateRandomCode = () => {
        const prefix = 'POI-';
        const randomPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const randomPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        setCode(`${prefix}${randomPart1}-${randomPart2}`);
    };

    // ── 教程选择相关 ──
    const toggleArticleSelection = (id, list, setter) => {
        if (list.includes(id)) {
            setter(list.filter(a => a !== id));
        } else {
            setter([...list, id]);
        }
    };

    const selectAllArticles = (setter) => {
        setter(allArticles.map(a => a.id));
    };

    const clearAllArticles = (setter) => {
        setter([]);
    };

    // ── 编辑已有 CDK 的教程绑定 ──
    const openEditArticles = (cdk) => {
        const linked = cdk.linked_articles || [];
        const parsed = typeof linked === 'string' ? JSON.parse(linked) : linked;
        setEditingCdkId(cdk.id);
        setEditArticleIds(parsed.map(a => a.id));
    };

    const handleSaveArticles = async () => {
        try {
            setEditLoading(true);
            await updateCdkArticles(editingCdkId, editArticleIds);
            setEditingCdkId(null);
            loadCdks();
        } catch (err) {
            alert('更新教程关联失败: ' + err.message);
        } finally {
            setEditLoading(false);
        }
    };

    // ── 教程选择器组件 ──
    const ArticleSelector = ({ selected, setSelected }) => (
        <div className="article-selector">
            <div className="selector-actions">
                <button type="button" className="inline-action-btn" onClick={() => selectAllArticles(setSelected)}>全部添加</button>
                <button type="button" className="inline-action-btn" onClick={() => clearAllArticles(setSelected)}>清空</button>
                <span className="selector-count">已选 {selected.length} 个教程</span>
            </div>
            <div className="article-checklist">
                {allArticles.length === 0 && <p className="empty-hint">暂无教程，请先在"教程管理"中发布教程</p>}
                {allArticles.map(article => (
                    <label key={article.id} className={`article-check-item ${selected.includes(article.id) ? 'active' : ''}`}>
                        <input
                            type="checkbox"
                            checked={selected.includes(article.id)}
                            onChange={() => toggleArticleSelection(article.id, selected, setSelected)}
                        />
                        <span className="article-check-title">{article.title}</span>
                        <span className="article-check-category">{article.category}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    if (loading) return <div className="cdk-manager"><p>加载中...</p></div>;
    if (error) return <div className="cdk-manager"><p className="error-text">{error}</p></div>;

    return (
        <div className="cdk-manager animate-fade-in">
            <div className="page-header">
                <div className="title-group">
                    <h2>CDK 凭证管理</h2>
                    <p className="page-desc">管理数字资产交付的访问凭证及安全密钥。</p>
                </div>
                <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
                    + 新建凭证
                </button>
            </div>

            <div className="table-container glass-panel">
                <table>
                    <thead>
                        <tr>
                            <th>CDK 凭据</th>
                            <th>使用次数</th>
                            <th>过期时间</th>
                            <th>创建时间</th>
                            <th>教程</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cdks.map(cdk => {
                            const linked = typeof cdk.linked_articles === 'string' ? JSON.parse(cdk.linked_articles) : (cdk.linked_articles || []);
                            return (
                                <tr key={cdk.id} className={cdk.is_active ? '' : 'disabled-row'}>
                                    <td><code className="cdk-code">{cdk.code}</code></td>
                                    <td>{cdk.used_count} / {cdk.max_uses || '∞'}</td>
                                    <td>{cdk.expires_at ? new Date(cdk.expires_at).toLocaleDateString() : '永久'}</td>
                                    <td>{new Date(cdk.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button className="link-btn" onClick={() => openEditArticles(cdk)}>
                                            {linked.length > 0 ? `${linked.length} 个模块` : '未绑定'}
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            className="action-text-btn"
                                            onClick={() => openEditModal(cdk)}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            className={`toggle-btn ${cdk.is_active ? 'active' : ''}`}
                                            onClick={() => handleToggle(cdk.id)}
                                            style={{ marginLeft: '10px' }}
                                        >
                                            {cdk.is_active ? '禁用' : '启用'}
                                        </button>
                                        <button
                                            className="action-text-btn danger"
                                            onClick={() => handleDelete(cdk.id, cdk.code)}
                                            style={{ marginLeft: '10px' }}
                                        >
                                            删除
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {cdks.length === 0 && (
                            <tr>
                                <td colSpan="6" className="empty-state">暂无 CDK 记录</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 新建 CDK Modal */}
            {showCreateModal && createPortal(
                <div className="modal-overlay">
                    <div className="modal-content admin-form glass-panel">
                        <h2>{editingCdkInfo ? '编辑 CDK 凭证' : '新建 CDK 凭证'}</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group row-group">
                                <div className="flex-1">
                                    <label>凭证码 (CDK)</label>
                                    <div className="input-with-action">
                                        <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="如 POI-XXXX-XXXX" required />
                                        <button type="button" onClick={generateRandomCode} className="inline-action-btn">生成</button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label>TOTP 密钥 (Secret Base32)</label>
                                    <div className="input-with-action">
                                        <input type="text" value={totpSecret} onChange={e => setTotpSecret(e.target.value)} placeholder="如 JBSWY3DPEHPK3PXP" required />
                                        <button type="button" onClick={generateRandomTotpSecret} className="inline-action-btn">生成</button>
                                    </div>
                                    <small>用于本地服务器生成 6 位 2FA 验证码的密钥。</small>
                                </div>
                            </div>

                            <div className="form-group row-group">
                                <div className="flex-1">
                                    <label>最大使用次数</label>
                                    <input type="number" min="0" value={maxUses} onChange={e => setMaxUses(e.target.value)} />
                                    <small>0 代表无限制次数</small>
                                </div>
                                <div className="flex-1">
                                    <label>有效天数</label>
                                    <input type="number" min="0" value={expiresDays} onChange={e => setExpiresDays(e.target.value)} />
                                    <small>0 代表永久有效</small>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>联系客服微信 (Base64 编码 - 可选)</label>
                                <input type="text" value={contactBase64} onChange={e => setContactBase64(e.target.value)} placeholder="留空则自动使用【站点设置】配置的统一微信号" />
                                <small>如不填写，验证时将自动使用站点设置中的全局默认客服微信 Base64。</small>
                            </div>

                            {!editingCdkInfo && (
                            <div className="form-group">
                                <label>绑定教程模块</label>
                                <ArticleSelector selected={selectedArticleIds} setSelected={setSelectedArticleIds} />
                            </div>
                            )}

                            {createError && <div className="error-text">{createError}</div>}

                            <div className="modal-actions">
                                <button type="button" className="secondary-btn" onClick={() => { setShowCreateModal(false); resetForm(); }} disabled={createLoading}>取消</button>
                                <button type="submit" className="primary-btn" disabled={createLoading}>
                                    {createLoading
                                        ? (editingCdkInfo ? '保存中...' : '创建中...')
                                        : (editingCdkInfo ? '保存修改' : '确认创建')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* 编辑教程关联 Modal */}
            {editingCdkId !== null && createPortal(
                <div className="modal-overlay">
                    <div className="modal-content admin-form glass-panel">
                        <h2>管理教程模块绑定</h2>
                        <ArticleSelector selected={editArticleIds} setSelected={setEditArticleIds} />
                        <div className="modal-actions" style={{ marginTop: '1rem' }}>
                            <button type="button" className="secondary-btn" onClick={() => setEditingCdkId(null)} disabled={editLoading}>取消</button>
                            <button type="button" className="primary-btn" onClick={handleSaveArticles} disabled={editLoading}>
                                {editLoading ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
