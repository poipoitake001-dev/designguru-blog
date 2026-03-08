import React from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    return (
        <div className="admin-dashboard animate-fade-in">
            <h2 style={{ marginBottom: '2rem', fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>欢迎回来，作者。</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1rem' }}>已发布教程</h3>
                    <p style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>12</p>
                </div>

                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1rem' }}>快捷操作</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <Link to="/admin/editor/new" className="admin-btn" style={{ textAlign: 'center' }}>
                            + 发布新文章
                        </Link>
                        <Link to="/admin/articles" className="follow-btn" style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                            管理内容
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
