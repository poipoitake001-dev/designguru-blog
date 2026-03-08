import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { fetchAbout } from '../services/api';
import './About.css';

export default function About() {
    const [about, setAbout] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAbout()
            .then(({ data }) => setAbout(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="about-page container">
                <div className="about-skeleton"></div>
            </div>
        );
    }

    const cleanContent = about?.content
        ? DOMPurify.sanitize(about.content, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder'] })
        : '';

    return (
        <div className="about-page animate-fade-in">
            <div className="container about-container">

                {/* Author Profile Card */}
                <section className="author-profile glass-panel">
                    <div className="author-avatar-large">
                        {about?.avatar ? (
                            <img src={about.avatar} alt={about.name} />
                        ) : (
                            <div className="avatar-placeholder">{(about?.name || 'A')[0]}</div>
                        )}
                    </div>
                    <h1 className="author-name">{about?.name || '作者'}</h1>
                    <p className="author-bio">{about?.bio || ''}</p>

                    <div className="social-links">
                        {about?.email && (
                            <a href={`mailto:${about.email}`} className="social-link" title="Email">📧 Email</a>
                        )}
                        {about?.github && (
                            <a href={about.github} target="_blank" rel="noopener noreferrer" className="social-link" title="GitHub">💻 GitHub</a>
                        )}
                        {about?.twitter && (
                            <a href={about.twitter} target="_blank" rel="noopener noreferrer" className="social-link" title="Twitter">🐦 Twitter</a>
                        )}
                    </div>
                </section>

                {/* About Content */}
                <section className="about-content">
                    <div className="section-header">
                        <h2>关于我</h2>
                        <div className="decorative-line"></div>
                    </div>
                    <div
                        className="rich-text-content"
                        dangerouslySetInnerHTML={{ __html: cleanContent }}
                    />
                </section>

            </div>
        </div>
    );
}
