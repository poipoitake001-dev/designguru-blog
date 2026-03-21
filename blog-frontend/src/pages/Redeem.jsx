import React, { useState } from 'react';
import { validateRedeemCode, submitRedeem } from '../services/api';
import './Redeem.css';

export default function Redeem() {
    // Step 1: validate
    const [code, setCode] = useState('');
    const [validating, setValidating] = useState(false);
    const [validateError, setValidateError] = useState('');
    const [productInfo, setProductInfo] = useState(null); // 验证成功后的商品信息

    // Step 2: submit
    const [email, setEmail] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [result, setResult] = useState(null); // 兑换成功后的结果

    const handleValidate = async (e) => {
        e.preventDefault();
        if (!code.trim()) {
            setValidateError('请输入兑换码');
            return;
        }
        setValidating(true);
        setValidateError('');
        setProductInfo(null);
        try {
            const resp = await validateRedeemCode(code.trim());
            // 兼容两种返回格式：
            // 1. 直接返回：{ valid, message, productName, ... }
            // 2. 包装返回：{ code, message, data: { valid, productName, ... } }
            const payload = (resp && resp.data && typeof resp.data === 'object') ? resp.data : resp;
            if (!payload.valid) {
                setValidateError(payload.message || resp.message || '兑换码无效');
                return;
            }
            setProductInfo(payload);
        } catch (err) {
            setValidateError(err.message);
        } finally {
            setValidating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            setSubmitError('请输入联系邮箱');
            return;
        }
        setSubmitting(true);
        setSubmitError('');
        try {
            const resp = await submitRedeem(code.trim(), email.trim(), quantity);
            // 兼容包装格式：{ code, message, data: { cards, orderNo, ... } }
            const normalized = (resp && resp.data && typeof resp.data === 'object')
                ? { ...resp, data: resp.data }
                : { data: resp };
            setResult(normalized);
        } catch (err) {
            setSubmitError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setCode('');
        setEmail('');
        setQuantity(1);
        setProductInfo(null);
        setResult(null);
        setValidateError('');
        setSubmitError('');
    };

    return (
        <div className="redeem-page">
            <div className="redeem-hero">
                <div className="redeem-icon">🎁</div>
                <h1>卡密兑换</h1>
                <p className="redeem-subtitle">输入您的兑换码，立即获取商品</p>
            </div>

            <div className="redeem-container">
                {/* ── 兑换成功结果 ── */}
                {result ? (
                    <div className="redeem-result animate-fade-in">
                        <div className="result-success-icon">✅</div>
                        <h2>兑换成功！</h2>
                        {result.data && (
                            <div className="result-cards">
                                {Array.isArray(result.data.cards) && result.data.cards.length > 0 ? (
                                    <>
                                        <p className="result-hint">以下是您兑换到的卡密，请妥善保存：</p>
                                        <ul className="card-list">
                                            {result.data.cards.map((card, i) => (
                                                <li key={i} className="card-item">
                                                    <code>{typeof card === 'object' ? JSON.stringify(card) : card}</code>
                                                    <button
                                                        className="copy-btn"
                                                        onClick={() => {
                                                            const text = typeof card === 'object' ? JSON.stringify(card) : card;
                                                            navigator.clipboard.writeText(text);
                                                        }}
                                                    >
                                                        复制
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <pre className="result-raw">{JSON.stringify(result.data, null, 2)}</pre>
                                )}
                                {result.data.orderNo && (
                                    <p className="result-order">订单号：<span>{result.data.orderNo}</span></p>
                                )}
                            </div>
                        )}
                        <button className="primary-btn redeem-reset-btn" onClick={handleReset}>
                            再次兑换
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── Step 1: 验证兑换码 ── */}
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
                                        placeholder="请输入兑换码，如 XXX-XXXX-XXXX-XXXX"
                                        value={code}
                                        onChange={e => { setCode(e.target.value); setProductInfo(null); setSubmitError(''); }}
                                        disabled={!!productInfo}
                                    />
                                    <button
                                        type="submit"
                                        className="primary-btn"
                                        disabled={validating || !!productInfo}
                                    >
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
                                        <button
                                            type="button"
                                            className="link-btn change-btn"
                                            onClick={() => { setProductInfo(null); setSubmitError(''); }}
                                        >
                                            更换兑换码
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* ── Step 2: 填写信息并兑换 ── */}
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
                                    <button
                                        type="submit"
                                        className="primary-btn redeem-submit-btn"
                                        disabled={submitting}
                                    >
                                        {submitting ? '兑换中...' : '确认兑换'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
