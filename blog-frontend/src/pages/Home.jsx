import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTutorials, fetchSettings } from '../services/api';
import './Home.css';

export default function Home() {
    const [tutorials, setTutorials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [heroTitle, setHeroTitle] = useState('探索 设计与代码的边界');
    const [heroSubtitle, setHeroSubtitle] = useState('分享最新的前端技术、Vanilla CSS 技巧以及具有高级质感的 UI/UX 教程');

    useEffect(() => {
        async function loadData() {
            try {
                const [articlesRes, settingsRes] = await Promise.all([
                    fetchTutorials(),
                    fetchSettings().catch(() => ({ data: {} }))
                ]);
                setTutorials(articlesRes.data);
                if (settingsRes.data.hero_title) setHeroTitle(settingsRes.data.hero_title);
                if (settingsRes.data.hero_subtitle) setHeroSubtitle(settingsRes.data.hero_subtitle);
            } catch (error) {
                console.error("Failed to load data:", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Split hero title to highlight first word
    const titleParts = heroTitle.split(' ');
    const highlightWord = titleParts[0] || '';
    const restTitle = titleParts.slice(1).join(' ');

    return (
        <div className="home-page animate-fade-in">
            <section className="hero-section">
                <div className="container hero-content">
                    <h1 className="hero-title">
                        <span className="gradient-text">{highlightWord}</span> {restTitle}
                    </h1>
                    <p className="hero-subtitle">{heroSubtitle}</p>
                </div>
            </section>

            <section className="tutorials-section container">
                <div className="section-header">
                    <h2>最新教程</h2>
                    <div className="decorative-line"></div>
                </div>

                {loading ? (
                    <div className="loading-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton-card glass-panel"></div>
                        ))}
                    </div>
                ) : (
                    <div className="tutorials-grid">
                        {tutorials.map(tutorial => (
                            <Link to={`/tutorial/${tutorial.id}`} key={tutorial.id} className="tutorial-card glass-panel">
                                <div className="card-image-wrapper">
                                    <img src={tutorial.coverImage} alt={tutorial.title} loading="lazy" />
                                    <span className="card-category">{tutorial.category}</span>
                                </div>
                                <div className="card-content">
                                    <span className="card-date">
                                        {new Date(tutorial.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                    <h3 className="card-title">{tutorial.title}</h3>
                                    <p className="card-summary">{tutorial.summary}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
