import React, { useState, useEffect, useRef } from 'react';
import { validateRedeemCode, submitRedeem, getRedeemTaskStatus } from '../services/api';
import './Redeem.css';

// deliveryStatus: 0=待发卡, 1=发卡中, 2=完成, 3=失败
const DELIVERY_LABELS = { 0: '待发卡', 1: '发卡中...', 2: '已完成', 3: '发卡失败' };

export default function Redeem() {
    // Step 1: validate
    const [code, setCode] = useState('');
    const [validating, setValidating] = useState(false);
    const [validateError, setValidateError] = useState('');
    const [productInfo, setProductInfo] = useState(null);

    // Step 2: submit
    const [email, setEmail] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Async polling state
    const [orderInfo, setOrderInfo] = useState(null);   // after submit success
    const [polling, setPolling] = useState(false);
    const [pollStatus, setPollStatus] = useState('');   // human-readable status
    const [cards, setCards] = useState(null);           // final cards
    const [pollError, setPollError] = useState('');
    const pollTimer = useRef(null);

    // Cleanup timer on unmount
    useEffect(() => () => clearTimeout(pollTimer.current), []);

    // ── Step 1: Validate ──
    const handleValidate = async (e) => {
        e.preventDefault();
        if (!code.trim()) { setValidateError('请输入兑换码'); return; }
        setValidating(true);
        setValidateError('');
        setProductInfo(null);
        try {
            const resp = await validateRedeemCode(code.trim());
            // resp = { code: 200, message, data: { valid, productName, ... } }
            const payload = resp?.data ?? resp;
            if (!payload?.valid) {
                setValidateError(payload?.message || resp?.message || '兑换码无效或已失效');
                return;
            }
            setProductInfo(payload);
        } catch (err) {
            setValidateError(err.message);
        } finally {
            setValidating(false);
        }
    };

    // ── Step 2: Submit & start polling ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) { setSubmitError('请输入联系邮箱'); return; }
        setSubmitting(true);
        setSubmitError('');
        try {
            const resp = await submitRedeem(code.trim(), email.trim(), quantity);
            // resp = { code: 200, message, data: { orderNo, taskId, deliveryStatus, ... } }
            const data = resp?.data ?? resp;
            setOrderInfo(data);

            if (data.deliveryStatus === 2 && data.cards?.length > 0) {
                // Immediately available (rare)
                setCards(data.cards);
            } else if (data.taskId) {
                // Start polling
                startPolling(data.taskId, data.deliveryStatus);
            } else {
                setPollStatus(DELIVERY_LABELS[data.deliveryStatus] || '发卡中...');
            }
        } catch (err) {
            setSubmitError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const startPolling = (taskId, initialStatus) => {
        setPolling(true);
        setPollStatus(DELIVERY_LABELS[initialStatus] ?? '发卡中...');
        setPollError('');
        poll(taskId, 0);
    };

    const poll = (taskId, attempt) => {
        if (attempt > 40) {
            // ~2 min timeout
            setPolling(false);
            setPollError('发卡超时，请联系客服或稍后在订单查询中查看。');
            return;
        }
        pollTimer.current = setTimeout(async () => {
            try {
                const resp = await getRedeemTaskStatus(taskId);
                const data = resp?.data ?? resp;
                const status = data?.status ?? data?.deliveryStatus;
                setPollStatus(DELIVERY_LABELS[status] ?? '发卡中...');

                if (status === 2 && data.cards?.length > 0) {
                    setPolling(false);
                    setCards(data.cards);
                } else if (status === 3) {
                    setPolling(false);
                    setPollError('发卡失败，请联系客服处理。');
                } else {
                    poll(taskId, attempt + 1);
                }
            } catch (err) {
                // Network error: retry
                poll(taskId, attempt + 1);
            }
        }, 3000);
    };

    const handleReset = () => {
        clearTimeout(pollTimer.current);
        setCode(''); setEmail(''); setQuantity(1);
        setProductInfo(null); setOrderInfo(null);
        setCards(null); setPolling(false);
        setValidateError(''); setSubmitError('');
        setPollStatus(''); setPollError('');
    };

    // ── Result: cards ──
    if (cards) {
        return (
            <div className="redeem-page">
                <div className="redeem-hero">
                    <div className="redeem-icon">🎁</div>
                    <h1>卡密兑换</h1>
                </div>
                <div className="redeem-container">
                    <div className="redeem-result animate-fade-in">
                        <div className="result-success-icon">✅</div>
                        <h2>兑换成功！</h2>
                        {orderInfo?.orderNo && (
                            <p className="result-order">订单号：<span>{orderInfo.orderNo}</span></p>
                        )}
                        <div className="result-cards">
                            <p className="result-hint">以下是您兑换到的卡密，请妥善保存：</p>
                            <ul className="card-list">
                                {cards.map((card, i) => {
                                    const display = typeof card === 'object'
                                        ? [card.cardNumber, card.cardPassword, card.expiry].filter(Boolean).join(' / ')
                                        : card;
                                    return (
                                        <li key={i} className="card-item">
                                            <div className="card-fields">
                                                {typeof card === 'object' ? (
                                                    <>
                                                        {card.cardNumber && <span><b>卡号：</b>{card.cardNumber}</span>}
                                                        {card.cardPassword && <span><b>密码：</b>{card.cardPassword}</span>}
                                                        {card.expiry && <span><b>有效期：</b>{card.expiry}</span>}
                                                    </>
                                                ) : (
                                                    <code>{card}</code>
                                                )}
                                            </div>
                                            <button
                                                className="copy-btn"
                                                onClick={() => navigator.clipboard.writeText(display)}
                                            >
                                                复制
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        <button className="primary-btn redeem-reset-btn" onClick={handleReset}>
                            再次兑换
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Result: polling / waiting ──
    if (orderInfo && !cards) {
        return (
            <div className="redeem-page">
                <div className="redeem-hero">
                    <div className="redeem-icon">🎁</div>
                    <h1>卡密兑换</h1>
                </div>
                <div className="redeem-container">
                    <div className="redeem-card animate-fade-in" style={{ textAlign: 'center' }}>
                        {pollError ? (
                            <>
                                <div style={{ fontSize: '2.5rem' }}>⚠️</div>
                                <h3 style={{ color: '#ef4444', margin: '0.75rem 0' }}>{pollError}</h3>
                                {orderInfo.orderNo && (
                                    <p className="result-order" style={{ textAlign: 'center' }}>
                                        订单号：<span>{orderInfo.orderNo}</span>
                                    </p>
                                )}
                                <button className="primary-btn redeem-reset-btn" onClick={handleReset} style={{ marginTop: '1rem' }}>
                                    返回重试
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="poll-spinner" />
                                <h3 className="poll-label">{pollStatus || '发卡中...'}</h3>
                                <p className="result-hint">发卡系统处理中，请稍候，请勿关闭页面</p>
                                {orderInfo.orderNo && (
                                    <p className="result-order">订单号：<span>{orderInfo.orderNo}</span></p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Main form ──
    return (
        <div className="redeem-page">
            <div className="redeem-hero">
                <div className="redeem-icon">🎁</div>
                <h1>卡密兑换</h1>
                <p className="redeem-subtitle">输入您的兑换码，立即获取商品</p>
            </div>

            <div className="redeem-container">
                {/* Step 1 */}
                <div className={`redeem-card animate-fade-in ${productInfo ? 'completed' : ''}`}>
                    <div className="step-label">
                        <span className="step-num">1</span>
                        验证兑换码
                        {productInfo && <span className="step-done">✔</span>}
                    </div>
                    <form onSubmit={handleValidate} className="redeem-form">
                        <div className="input-row">
                            <input
                                type="text"
                                className="redeem-input"
                                placeholder="请输入兑换码，如 XXXX-XXXX-XXXX-XXXX"
                                value={code}
                                onChange={e => { setCode(e.target.value); setProductInfo(null); }}
                                disabled={!!productInfo}
                            />
                            <button type="submit" className="primary-btn" disabled={validating || !!productInfo}>
                                {validating ? '验证中...' : '验证'}
                            </button>
                        </div>
                        {validateError && <p className="redeem-error">{validateError}</p>}
                        {productInfo && (
                            <div className="product-info animate-fade-in">
                                <div className="product-info-row">
                                    <span className="info-label">商品名称</span>
                                    <span className="info-value">{productInfo.productName || '—'}</span>
                                </div>
                                <div className="product-info-row">
                                    <span className="info-label">可兑换数量</span>
                                    <span className="info-value">{productInfo.quantity ?? '—'}</span>
                                </div>
                                {productInfo.remainingQuantity !== undefined && (
                                    <div className="product-info-row">
                                        <span className="info-label">剩余库存</span>
                                        <span className="info-value">{productInfo.remainingQuantity}</span>
                                    </div>
                                )}
                                {productInfo.expireTime && (
                                    <div className="product-info-row">
                                        <span className="info-label">过期时间</span>
                                        <span className="info-value">{productInfo.expireTime}</span>
                                    </div>
                                )}
                                <button type="button" className="link-btn change-btn"
                                    onClick={() => setProductInfo(null)}>
                                    更换兑换码
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                {/* Step 2 */}
                {productInfo && (
                    <div className="redeem-card animate-fade-in">
                        <div className="step-label">
                            <span className="step-num">2</span>
                            填写兑换信息
                        </div>
                        <form onSubmit={handleSubmit} className="redeem-form">
                            <label className="redeem-label">联系邮箱 <span className="required">*</span></label>
                            <input
                                type="email"
                                className="redeem-input"
                                placeholder="用于接收兑换结果通知"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                            {productInfo.quantity > 1 && (
                                <>
                                    <label className="redeem-label">兑换数量</label>
                                    <input
                                        type="number"
                                        className="redeem-input redeem-input-sm"
                                        min={1}
                                        max={productInfo.quantity}
                                        value={quantity}
                                        onChange={e => setQuantity(Number(e.target.value))}
                                    />
                                </>
                            )}
                            {submitError && <p className="redeem-error">{submitError}</p>}
                            <button type="submit" className="primary-btn redeem-submit-btn" disabled={submitting}>
                                {submitting ? '提交中...' : '确认兑换'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
