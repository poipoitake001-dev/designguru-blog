import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { fetchTutorialDetail, fetchAbout } from '../services/api';
import './TutorialDetail.css';

/**
 * Extract headings from HTML string to build a dynamic Table of Contents.
 * Returns array of { id, text, level }.
 */
function extractHeadings(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headings = [];
    doc.querySelectorAll('h2, h3').forEach((el, i) => {
        const id = `toc-heading-${i}`;
        headings.push({ id, text: el.textContent.trim(), level: el.tagName === 'H2' ? 2 : 3 });
    });
    return headings;
}

/**
 * Inject `id` attributes into heading tags in the HTML so anchor links work.
 */
function injectHeadingIds(html) {
    let index = 0;
    return html.replace(/<(h[23])([^>]*)>/gi, (match, tag, attrs) => {
        const id = `toc-heading-${index++}`;
        // If there's already an id, replace it; otherwise add one
        if (/id\s*=/.test(attrs)) {
            attrs = attrs.replace(/id\s*=\s*["'][^"']*["']/, `id="${id}"`);
        } else {
            attrs += ` id="${id}"`;
        }
        return `<${tag}${attrs}>`;
    });
}

export default function TutorialDetail() {
    const { id } = useParams();
    const [tutorial, setTutorial] = useState(null);
    const [aboutData, setAboutData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeHeadingId, setActiveHeadingId] = useState(null);
    const observerRef = useRef(null);

    useEffect(() => {
        async function loadData() {
            try {
                const [tutorialRes, aboutRes] = await Promise.all([
                    fetchTutorialDetail(id),
                    fetchAbout().catch(() => ({ data: {} }))
                ]);
                setTutorial(tutorialRes.data);
                setAboutData(aboutRes.data);
            } catch (error) {
                console.error("Failed to load tutorial:", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    // IntersectionObserver to highlight current heading in TOC
    const setupObserver = useCallback((headings) => {
        if (observerRef.current) observerRef.current.disconnect();
        if (!headings.length) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveHeadingId(entry.target.id);
                        break;
                    }
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
        );

        // Small delay to let DOM render
        setTimeout(() => {
            headings.forEach(({ id }) => {
                const el = document.getElementById(id);
                if (el) observerRef.current.observe(el);
            });
        }, 200);

        return () => observerRef.current?.disconnect();
    }, []);

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
    const readTime = Math.max(1, Math.ceil(wordCount / 400));

    // Sanitize & inject heading IDs
    const sanitized = DOMPurify.sanitize(tutorial.content, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling']
    });
    const cleanContent = injectHeadingIds(sanitized);

    // Extract headings for dynamic TOC
    const headings = extractHeadings(sanitized);

    // Author info: prefer about table data, fallback to article author
    const authorName = aboutData?.name || tutorial.author || 'Admin';
    const authorBio = aboutData?.bio || '';
    const authorAvatar = aboutData?.avatar || '';
    const authorEmail = aboutData?.email || '';

    const handleContactClick = () => {
        if (authorEmail) {
            window.location.href = `mailto:${authorEmail}`;
        } else {
            window.location.href = '/about';
        }
    };

    const handleHeadingClick = (e, headingId) => {
        e.preventDefault();
        const el = document.getElementById(headingId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveHeadingId(headingId);
        }
    };

    return (
        <TocObserverSetup headings={headings} setupObserver={setupObserver}>
            <article className="tutorial-page animate-fade-in">
                {/* Header Banner */}
                <header className="tutorial-header" style={{ backgroundImage: `url(${tutorial.coverImage})` }}>
                    <div className="header-overlay glass-panel">
                        <div className="container header-content">
                            <span className="category-tag">{tutorial.category}</span>
                            <h1 className="title">{tutorial.title}</h1>
                            <div className="meta">
                                <span className="author">By {authorName}</span>
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

                    {/* Left Sidebar: Dynamic Table of Contents */}
                    <aside className="sidebar left-sidebar">
                        <div className="sticky-nav">
                            <Link to="/" className="back-btn">
                                <span className="icon">←</span> 返回教程列表
                            </Link>
                            {headings.length > 0 && (
                                <div className="toc-glass glass-panel">
                                    <h3 className="toc-title">章节导航</h3>
                                    <ul className="toc-list">
                                        {headings.map((h) => (
                                            <li key={h.id} className={`${activeHeadingId === h.id ? 'active' : ''} ${h.level === 3 ? 'toc-indent' : ''}`}>
                                                <a href={`#${h.id}`} onClick={(e) => handleHeadingClick(e, h.id)}>
                                                    {h.text}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Center Reader Area */}
                    <main className="main-content">
                        <div
                            className="rich-text-content"
                            dangerouslySetInnerHTML={{ __html: cleanContent }}
                        />
                    </main>

                    {/* Right Sidebar: Author Card */}
                    <aside className="sidebar right-sidebar">
                        <div className="sticky-nav">
                            <div className="author-card glass-panel">
                                {authorAvatar ? (
                                    <img className="author-avatar-img" src={authorAvatar} alt={authorName} />
                                ) : (
                                    <div className="author-avatar" />
                                )}
                                <h4>{authorName}</h4>
                                {authorBio && <p>{authorBio}</p>}
                                <button className="follow-btn" onClick={handleContactClick}>联系作者</button>
                            </div>
                        </div>
                    </aside>
                </div>
            </article>
        </TocObserverSetup>
    );
}

/**
 * A tiny wrapper that triggers the IntersectionObserver setup after mount.
 */
function TocObserverSetup({ headings, setupObserver, children }) {
    useEffect(() => {
        const cleanup = setupObserver(headings);
        return cleanup;
    }, [headings, setupObserver]);
    return <>{children}</>;
}
