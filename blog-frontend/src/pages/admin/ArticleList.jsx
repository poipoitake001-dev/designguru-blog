import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchTutorials, deleteArticle } from '../../services/api';
import './AdminTable.css';

export default function ArticleList() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null); // ID currently pending confirmation
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        setLoading(true);
        try {
            const { data } = await fetchTutorials();
            setArticles(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Step 1: User clicks "删除" → show inline confirm row
    const promptDelete = (id) => {
        setDeletingId(id);
    };

    // Step 2: User confirms → call API
    const confirmDelete = async () => {
        if (!deletingId || processing) return;
        setProcessing(true);
        try {
            await deleteArticle(deletingId);
            setArticles(prev => prev.filter(a => a.id !== deletingId));
            setDeletingId(null);
        } catch (error) {
            console.error('Delete failed:', error);
            alert('删除失败，请检查网络连接');
        } finally {
            setProcessing(false);
        }
    };

    const cancelDelete = () => {
        setDeletingId(null);
    };

    return (
        <div className="admin-article-list animate-fade-in">
            <div className="list-header">
                <h2>教程管理</h2>
                <Link to="/admin/editor/new" className="admin-btn">+ 发布教程</Link>
            </div>

            <div className="table-container glass-panel">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>封面</th>
                            <th>标题</th>
                            <th>分类</th>
                            <th>发布时间</th>
                            <th className="action-col">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="empty-state">加载中...</td></tr>
                        ) : articles.length === 0 ? (
                            <tr><td colSpan="5" className="empty-state">暂无教程，去发布第一篇吧！</td></tr>
                        ) : (
                            articles.map(article => (
                                <React.Fragment key={article.id}>
                                    <tr className={deletingId === article.id ? 'row-danger' : ''}>
                                        <td className="td-image">
                                            <img src={article.coverImage} alt={article.title} />
                                        </td>
                                        <td className="td-title">{article.title}</td>
                                        <td><span className="badge">{article.category}</span></td>
                                        <td className="td-date">
                                            {new Date(article.publishedAt).toLocaleDateString('zh-CN')}
                                        </td>
                                        <td className="action-col">
                                            <div className="action-btns">
                                                <Link to={`/admin/editor/${article.id}`} className="edit-btn">编辑</Link>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => promptDelete(article.id)}
                                                    disabled={processing}
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Inline confirmation row */}
                                    {deletingId === article.id && (
                                        <tr className="confirm-row">
                                            <td colSpan="5">
                                                <div className="confirm-bar">
                                                    <span className="confirm-msg">⚠️ 确定要删除《{article.title}》？此操作不可撤销。</span>
                                                    <div className="confirm-actions">
                                                        <button className="cancel-btn" onClick={cancelDelete} disabled={processing}>
                                                            取消
                                                        </button>
                                                        <button className="delete-confirm-btn" onClick={confirmDelete} disabled={processing}>
                                                            {processing ? '删除中...' : '确认删除'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
