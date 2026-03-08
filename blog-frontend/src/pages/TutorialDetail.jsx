import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { fetchTutorialDetail } from '../services/api';
import './TutorialDetail.css';

export default function TutorialDetail() {
    const { id } = useParams();
    const [tutorial, setTutorial] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const { data } = await fetchTutorialDetail(id);
                setTutorial(data);
            } catch (error) {
                console.error("Failed to load tutorial:", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    if (loading) {
        return (
            <div className="container tutorial-detail-loading">
                <div className="skeleton-title"></div>
                <div className="skeleton-content"></div>
            </div>
        );
    }

    if (!tutorial) {
        return (
            <div className="container not-found">
                <h2>未找到该教程 💔</h2>
                <Link to="/" className="back-link">返回首页</Link>
            </div>
        );
    }

    // Calculate read time roughly
    const wordCount = tutorial.content?.replace(/<[^>]*>?/gm, '').length || 0;
    const readTime = Math.max(1, Math.ceil(wordCount / 400)); // ~400 chars per min in Chinese

    // Sanitize the HTML coming from backend (WangEditor output)
    const cleanContent = DOMPurify.sanitize(tutorial.content, {
        ADD_TAGS: ['iframe'], // Allow iframes for video embeds
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling']
    });

    return (
        <article className="tutorial-page animate-fade-in">
            {/* Header Banner */}
            <header className="tutorial-header" style={{ backgroundImage: `url(${tutorial.coverImage})` }}>
                <div className="header-overlay glass-panel">
                    <div className="container header-content">
                        <span className="category-tag">{tutorial.category}</span>
                        <h1 className="title">{tutorial.title}</h1>
                        <div className="meta">
                            <span className="author">By {tutorial.author}</span>
                            <span className="dot">•</span>
                            <span className="date">发布于 {new Date(tutorial.publishedAt).toLocaleDateString('zh-CN')}</span>
                            <span className="dot">•</span>
                            <span className="read-time">约 {readTime} 分钟阅读</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="container tutorial-body">

                {/* Left Sidebar: Navigation / Table of Contents (Simulated for design) */}
                <aside className="sidebar left-sidebar">
                    <div className="sticky-nav">
                        <Link to="/" className="back-btn">
                            <span className="icon">←</span> 返回教程列表
                        </Link>
                        <div className="toc-glass glass-panel">
                            <h3 className="toc-title">章节导航</h3>
                            <ul className="toc-list">
                                <li className="active"><a href="#_top">引言</a></li>
                                <li><a href="#theory">理论基础</a></li>
                                <li><a href="#practice">实践应用</a></li>
                            </ul>
                        </div>
                    </div>
                </aside>

                {/* Center Reader Area */}
                <main className="main-content">
                    <div
                        className="rich-text-content"
                        dangerouslySetInnerHTML={{ __html: cleanContent }}
                    />
                </main>

                {/* Right Sidebar: Recommended / Ads */}
                <aside className="sidebar right-sidebar">
                    <div className="sticky-nav">
                        <div className="author-card glass-panel">
                            <div className="author-avatar" />
                            <h4>{tutorial.author}</h4>
                            <p>资深 UI/UX 设计师，专注于创造有质感的数字体验。</p>
                            <button className="follow-btn">关注作者</button>
                        </div>
                    </div>
                </aside>
            </div>
        </article>
    );
}
