import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();

    const isCurrent = (path) => {
        if (path === '/admin') return location.pathname === '/admin' ? 'active' : '';
        return location.pathname.startsWith(path) ? 'active' : '';
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        navigate('/admin/login', { replace: true });
    };

    return (
        <div className="admin-layout">
            {/* Sidebar Navigation */}
            <aside className="admin-sidebar glass-panel">
                <div className="admin-logo">
                    <Link to="/admin">
                        <h2>DesignGuru</h2>
                        <span className="logo-badge">Admin</span>
                    </Link>
                </div>

                <nav className="admin-nav">
                    <div className="nav-group-label">内容管理</div>
                    <Link to="/admin" className={`admin-nav-item ${isCurrent('/admin')}`}>
                        <span className="icon">📊</span>
                        仪表大盘
                    </Link>
                    <Link to="/admin/articles" className={`admin-nav-item ${isCurrent('/admin/articles')}`}>
                        <span className="icon">📝</span>
                        教程管理
                    </Link>
                    <Link to="/admin/editor/new" className={`admin-nav-item ${isCurrent('/admin/editor')}`}>
                        <span className="icon">✨</span>
                        发布新教程
                    </Link>

                    <div className="nav-group-label" style={{ marginTop: '1.5rem' }}>系统设置</div>
                    <Link to="/admin/settings" className={`admin-nav-item ${isCurrent('/admin/settings')}`}>
                        <span className="icon">⚙️</span>
                        站点设置
                    </Link>
                    <Link to="/admin/about" className={`admin-nav-item ${isCurrent('/admin/about')}`}>
                        <span className="icon">👤</span>
                        关于作者
                    </Link>
                    <Link to="/admin/navigation" className={`admin-nav-item ${isCurrent('/admin/navigation')}`}>
                        <span className="icon">🧭</span>
                        导航管理
                    </Link>
                </nav>

                <div className="admin-sidebar-footer">
                    <Link to="/" className="exit-admin">
                        <span className="icon">←</span> 返回前台
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="admin-main">
                <header className="admin-header glass-panel">
                    <div className="header-breadcrumbs">
                        <span>Admin</span> / <span>{location.pathname.split('/').pop() || 'Dashboard'}</span>
                    </div>
                    <div className="header-actions">
                        <div className="admin-user">
                            <div className="avatar">A</div>
                            <span>Admin</span>
                        </div>
                        <button className="logout-btn" onClick={handleLogout} title="退出登录">
                            ⎋ 退出
                        </button>
                    </div>
                </header>

                <div className="admin-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
