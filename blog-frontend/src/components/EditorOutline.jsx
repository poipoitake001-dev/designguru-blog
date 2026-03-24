import React, { useMemo } from 'react';
import './EditorOutline.css';

/**
 * Real-time chapter outline for the article editor (Feishu-style).
 *
 * Props:
 *   editor - WangEditor instance (used to scroll to heading)
 *   html   - current editor HTML content
 */
export default function EditorOutline({ editor, html }) {
    // Extract headings from HTML content
    const headings = useMemo(() => {
        if (!html) return [];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const result = [];
            doc.querySelectorAll('h1, h2, h3').forEach((el, i) => {
                const text = el.textContent.trim();
                if (text) {
                    result.push({
                        index: i,
                        text,
                        level: parseInt(el.tagName[1], 10),
                    });
                }
            });
            return result;
        } catch {
            return [];
        }
    }, [html]);

    // Click handler: scroll to the heading in the editor
    const handleClick = (e, headingIndex) => {
        e.preventDefault();
        if (!editor) return;

        try {
            // Find the editable container
            const container = editor.getEditableContainer?.();
            if (!container) return;

            // Find all heading elements in the actual editor DOM
            const headingEls = container.querySelectorAll('h1, h2, h3');
            const target = headingEls[headingIndex];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Brief highlight effect
                target.style.transition = 'background 0.3s';
                target.style.background = 'rgba(59, 130, 246, 0.12)';
                setTimeout(() => {
                    target.style.background = '';
                }, 1200);
            }
        } catch (err) {
            console.warn('Outline scroll failed:', err);
        }
    };

    return (
        <div className="editor-outline">
            <div className="editor-outline-inner">
                <div className="editor-outline-header">
                    <h4>
                        <span className="outline-icon">📑</span>
                        章节导航
                    </h4>
                    {headings.length > 0 && (
                        <span className="outline-count">{headings.length}</span>
                    )}
                </div>

                {headings.length === 0 ? (
                    <div className="outline-empty">
                        <span className="empty-icon">📝</span>
                        使用标题（H1-H3）来<br />组织文章结构
                    </div>
                ) : (
                    <ul className="outline-list">
                        {headings.map((h) => (
                            <li
                                key={h.index}
                                className="outline-item"
                                data-level={h.level}
                            >
                                <a
                                    href="#"
                                    title={h.text}
                                    onClick={(e) => handleClick(e, h.index)}
                                >
                                    {h.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
