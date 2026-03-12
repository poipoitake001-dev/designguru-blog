import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../services/api';
import './AdminLogin.css';

export default function AdminLogin() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { token } = await login(password);
            localStorage.setItem('admin_token', token);
            navigate('/admin', { replace: true });
        } catch (err) {
            setError(err.message || '密码错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <span className="login-logo-icon">✦</span>
                    <span className="login-logo-text">DesignGuru</span>
                </div>
                <h1 className="login-title">管理台</h1>
                <p className="login-subtitle">请输入管理密码以继续</p>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label htmlFor="password">管理密码</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder="••••••••"
                            autoFocus
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div className="login-error">
                            <span>⚠</span> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading || !password}
                    >
                        {loading ? '验证中...' : '进入管理台'}
                    </button>
                </form>
            </div>
        </div>
    );
}
