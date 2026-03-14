import React, { useState, useEffect } from 'react';
import { fetchCdks, createCdk, toggleCdkStatus } from '../../services/api';
import './CdkManager.css';

export default function CdkManager() {
    const [cdks, setCdks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form state
    const [code, setCode] = useState('');
    const [totpSecret, setTotpSecret] = useState('');
    const [tutorialText, setTutorialText] = useState('');
    const [contactBase64, setContactBase64] = useState('');
    const [maxUses, setMaxUses] = useState(0);
    const [expiresDays, setExpiresDays] = useState(0);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        loadCdks();
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

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!code || !totpSecret) {
            setCreateError('CDK 凭据和 TOTP 密钥不能为空');
            return;
        }

        try {
            setCreateLoading(true);
            await createCdk({
                code: code.trim().toUpperCase(),
                totp_secret: totpSecret.trim(),
                tutorial_text: tutorialText,
                contact_base64: contactBase64.trim(),
                max_uses: Number(maxUses),
                expires_days: Number(expiresDays)
            });
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

    const resetForm = () => {
        setCode('');
        setTotpSecret('');
        setTutorialText('');
        setContactBase64('');
        setMaxUses(0);
        setExpiresDays(0);
        setCreateError('');
    };

    const generateRandomTotpSecret = () => {
        // Simple base32-like string generator for TOTP secret
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

    if (loading && cdks.length === 0) return <div className="admin-loading"><div className="spinner"></div></div>;

    return (
        <div className="cdk-manager animate-fade-in">
            <header className="page-header">
                <div className="title-group">
                    <h1>CDK 凭证管理</h1>
                    <p>管理数字资产交付的访问凭证及安全密钥。</p>
                </div>
                <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
                    + 新建凭证
                </button>
            </header>

            {error && <div className="error-banner">{error}</div>}

            <div className="table-container glass-panel">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>CDK 凭据</th>
                            <th>使用次数</th>
                            <th>过期时间</th>
                            <th>创建时间</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cdks.map(cdk => (
                            <tr key={cdk.id} className={!cdk.is_active ? 'inactive-row' : ''}>
                                <td><span className="code-badge">{cdk.code}</span></td>
                                <td>
                                    {cdk.used_count} / {cdk.max_uses > 0 ? cdk.max_uses : '无限制'}
                                </td>
                                <td>
                                    {cdk.expires_at ? new Date(cdk.expires_at).toLocaleDateString() : '永久有效'}
                                </td>
                                <td>{new Date(cdk.created_at).toLocaleDateString()}</td>
                                <td>
                                    <span className={`status-dot ${cdk.is_active ? 'active' : 'disabled'}`}>
                                        {cdk.is_active ? '启用中' : '已禁用'}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className={`action-text-btn ${cdk.is_active ? 'danger' : 'success'}`}
                                        onClick={() => handleToggle(cdk.id)}
                                    >
                                        {cdk.is_active ? '禁用' : '启用'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {cdks.length === 0 && (
                            <tr>
                                <td colSpan="6" className="empty-state">暂无 CDK 记录</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create CDK Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content admin-form glass-panel">
                        <h2>新建 CDK 凭证</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group row-group">
                                <div className="flex-1">
                                    <label>凭证码 (CDK)</label>
                                    <div className="input-with-action">
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={e => setCode(e.target.value)}
                                            placeholder="如 POI-XXXX-XXXX"
                                            required
                                        />
                                        <button type="button" onClick={generateRandomCode} className="inline-action-btn">生成</button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label>TOTP 密钥 (Secret Base32)</label>
                                    <div className="input-with-action">
                                        <input
                                            type="text"
                                            value={totpSecret}
                                            onChange={e => setTotpSecret(e.target.value)}
                                            placeholder="如 JBSWY3DPEHPK3PXP"
                                            required
                                        />
                                        <button type="button" onClick={generateRandomTotpSecret} className="inline-action-btn">生成</button>
                                    </div>
                                    <small>用于本地服务器生成 6 位 2FA 验证码的密钥。</small>
                                </div>
                            </div>

                            <div className="form-group row-group">
                                <div className="flex-1">
                                    <label>最大使用次数</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={maxUses}
                                        onChange={e => setMaxUses(e.target.value)}
                                    />
                                    <small>0 代表无限制次数</small>
                                </div>
                                <div className="flex-1">
                                    <label>有效天数</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expiresDays}
                                        onChange={e => setExpiresDays(e.target.value)}
                                    />
                                    <small>0 代表永久有效</small>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>联系客服微信 (Base64 编码 - 可选)</label>
                                <input
                                    type="text"
                                    value={contactBase64}
                                    onChange={e => setContactBase64(e.target.value)}
                                    placeholder="输入您的微信号的 Base64 编码 (例如 d3hfaWQ=)"
                                />
                                <small>将微信号通过 btoa('WeChatID') 处理后的 Base64 字符串，前端将混淆处理。</small>
                            </div>

                            <div className="form-group">
                                <label>验证成功后渲染的 HTML 教程内容 (可选)</label>
                                <textarea
                                    className="form-control"
                                    rows="4"
                                    value={tutorialText}
                                    onChange={e => setTutorialText(e.target.value)}
                                    placeholder="填入一段 HTML 或者富文本教程内容，将在前台验证成功后折叠展示。"
                                />
                            </div>

                            {createError && <div className="error-text">{createError}</div>}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                                    disabled={createLoading}
                                >
                                    取消
                                </button>
                                <button type="submit" className="primary-btn" disabled={createLoading}>
                                    {createLoading ? '创建中...' : '确认创建'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
