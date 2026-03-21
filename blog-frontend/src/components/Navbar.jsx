import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchSettings } from '../services/api';
import './Navbar.css';

const DEFAULT_NAV_ITEMS = [
    { label: '所有教程', path: '/' },
    { label: '关于作者', path: '/about' }
];

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [siteName, setSiteName] = useState('DesignGuru');
    const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);
    const location = useLocation();

    useEffect(() => {
        if (document.documentElement.classList.contains('dark')) {
            setIsDarkMode(true);
        }

        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);

        // Load site settings (name + nav items) from backend
        fetchSettings().then(({ data }) => {
            if (data.site_name) setSiteName(data.site_name);
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
        }).catch(() => { });

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.remove('dark');
            setIsDarkMode(false);
        } else {
            root.classList.add('dark');
            setIsDarkMode(true);
        }
    };

    const isCurrent = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <header className={`navbar-header ${isScrolled ? 'scrolled' : ''}`}>
            <div className="container navbar-container">

                <Link to="/" className="navbar-logo">
                    <span className="logo-icon"></span>
                    <h2>{siteName}</h2>
                </Link>

                <nav className="navbar-links">
                    {navItems.map((item, i) => (
                        <Link
                            key={i}
                            to={item.path}
                            className={`nav-link ${isCurrent(item.path)}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <Link
                        to="/redeem"
                        className={`nav-link nav-link-redeem ${isCurrent('/redeem')}`}
                    >
                        🎁 卡密兑换
                    </Link>
                </nav>

                <div className="navbar-actions">
                    <button
                        className="theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Toggle Dark Mode"
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                    {/* 后台管理入口已移除，管理员直接访问 /admin */}
                </div>

            </div>
        </header>
    );
}
