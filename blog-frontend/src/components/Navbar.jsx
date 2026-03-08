import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchSettings } from '../services/api';
import './Navbar.css';

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [siteName, setSiteName] = useState('DesignGuru');
    const location = useLocation();

    useEffect(() => {
        if (document.documentElement.classList.contains('dark')) {
            setIsDarkMode(true);
        }

        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);

        // Load site name from backend
        fetchSettings().then(({ data }) => {
            if (data.site_name) setSiteName(data.site_name);
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
                    <Link to="/" className={`nav-link ${isCurrent('/')}`}>所有教程</Link>
                    <Link to="/about" className={`nav-link ${isCurrent('/about')}`}>关于作者</Link>
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
