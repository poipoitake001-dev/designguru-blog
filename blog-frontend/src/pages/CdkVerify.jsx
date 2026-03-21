import React, { useState, useEffect, useRef } from 'react';
import SecureContentLoader from '../components/SecureContentLoader';
import { validateRedeemCode, submitRedeem, getRedeemTaskStatus } from '../services/api';
import './CdkVerify.css';

// deliveryStatus / task status: 0=待发卡, 1=发卡中, 2=完成, 3=失败
const DELIVERY_LABELS = { 0: '待发卡', 1: '发卡中...', 2: '已完成', 3: '发卡失败' };

// 字段名 → 中文标签映射（按展示顺序）
const FIELD_LABELS = [
    ['cardNumber',     '卡号'],
    ['expiry',         '有效期'],
    ['cardPassword',   'CVV'],
    ['cvv',            'CVV'],
    ['openTime',       '开卡时间'],
    ['createdAt',      '开卡时间'],
    ['remainingTime',  '剩余时间'],
    ['region',         '地区'],
    ['country',        '地区'],
    ['name',           '姓名'],
    ['address',        '地址'],
    ['city',           '城市'],
    ['state',          '州'],
    ['zip',            '邮编'],
    ['zipCode',        '邮编'],
    ['info',           '信息'],
    ['remark',         '备注'],
];

// 高亮字段（金色）
const HIGHLIGHT_KEYS = new Set(['cardNumber', 'cardPassword', 'cvv']);
// 绿色字段（剩余时间）
const GREEN_KEYS = new Set(['remainingTime']);

/* 单张卡片详情组件 */
function CardDetail({ card, index }) {
    if (typeof card !== 'object' || card === null) {
        return (
            <li className="rdm-card-item">
                <div className="rdm-card-fields"><code>{card}</code></div>
                <button className="rdm-copy-btn"
                    onClick={() => navigator.clipboard.writeText(card)}>复制</button>
            </li>
        );
    }

    // 已知字段按顺序排列，未知字段附在后面
    const knownKeys = FIELD_LABELS.map(([k]) => k);
    const unknownEntries = Object.entries(card).filter(
        ([k]) => !knownKeys.includes(k) && k !== 'cardData'
    );

    const orderedEntries = [
        ...FIELD_LABELS.filter(([k]) => card[k] !== undefined && card[k] !== null && card[k] !== ''),
        ...unknownEntries.map(([k, v]) => [k, String(k)])
    ];

    // 복사 전체
    const copyAll = orderedEntries
        .map(([k, label]) => {
            const realLabel = FIELD_LABELS.find(([fk]) => fk === k)?.[1] ?? label;
            return `${realLabel}: ${card[k]}`;
        })
        .join('\n');

    return (
        <li className="rdm-card-detail-item">
            {index !== undefined && <div className="rdm-card-index">#{index + 1}</div>}
            <table className="rdm-card-table">
                <tbody>
                    {orderedEntries.map(([key]) => {
                        const labelEntry = FIELD_LABELS.find(([k]) => k === key);
                        const label = labelEntry ? labelEntry[1] : key;
                        const value = String(card[key]);
                        const isHighlight = HIGHLIGHT_KEYS.has(key);
                        const isGreen = GREEN_KEYS.has(key);
                        return (
                            <tr key={key} className="rdm-card-row">
                                <td className="rdm-card-row__label">{label}</td>
                                <td className={`rdm-card-row__value ${isHighlight ? 'rdm-val-highlight' : ''} ${isGreen ? 'rdm-val-green' : ''}`}>
                                    {value}
                                </td>
                                <td className="rdm-card-row__copy">
                                    <button
                                        className="rdm-field-copy-btn"
                                        title="复制"
                                        onClick={() => navigator.clipboard.writeText(value)}
                                    >⧉</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="rdm-card-copyall-row">
                <button
                    className="rdm-copyall-btn"
                    onClick={() => navigator.clipboard.writeText(copyAll)}
                >⧉ 复制全部</button>
            </div>
        </li>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RedeemPanel — 卡密兑换面板（融合进 CdkVerify 深色主题）
───────────────────────────────────────────────────────────────────────────── */
function RedeemPanel() {
    const [code, setCode] = useState('');
    const [validating, setValidating] = useState(false);
    const [validateError, setValidateError] = useState('');
    const [productInfo, setProductInfo] = useState(null);
    const [usedRecord, setUsedRecord] = useState(null);  // 已使用过、含历史卡密的记录
    const [showUsedCards, setShowUsedCards] = useState(false);

    const [email, setEmail] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const [orderInfo, setOrderInfo] = useState(null);
    const [polling, setPolling] = useState(false);
    const [pollStatus, setPollStatus] = useState('');
    const [cards, setCards] = useState(null);
    const [pollError, setPollError] = useState('');
    const pollTimer = useRef(null);

    useEffect(() => () => clearTimeout(pollTimer.current), []);

    const handleValidate = async (e) => {
        e.preventDefault();
        if (!code.trim()) { setValidateError('请输入兑换码'); return; }
        setValidating(true);
        setValidateError('');
        setProductInfo(null);
        setUsedRecord(null);
        setShowUsedCards(false);
        try {
            const resp = await validateRedeemCode(code.trim());
            const payload = resp?.data ?? resp;
            if (!payload?.valid) {
                // 若 API 返回了历史卡密（兑换码已使用），展示查看记录功能
                if (payload?.orderNo || payload?.cards?.length > 0) {
                    setUsedRecord(payload);
                } else {
                    setValidateError(payload?.message || resp?.message || '兑换码无效或已失效');
                }
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
        if (!email.trim()) { setSubmitError('请输入联系邮箱'); return; }
        setSubmitting(true);
        setSubmitError('');
        try {
            const resp = await submitRedeem(code.trim(), email.trim(), quantity);
            const data = resp?.data ?? resp;
            setOrderInfo(data);
            if (data.deliveryStatus === 2 && data.cards?.length > 0) {
                setCards(data.cards);
            } else if (data.taskId) {
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
            setPolling(false);
            setPollError('发卡超时，请联系客服或稍后查询订单。');
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
            } catch {
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
        setUsedRecord(null); setShowUsedCards(false);
    };

    // ── 兑换成功：展示卡密 ──
    if (cards) {
        return (
            <div className="rdm-result rdm-fade-in">
                <div className="rdm-result__icon">✅</div>
                <h3 className="rdm-result__title">兑换成功！</h3>
                {orderInfo?.orderNo && (
                    <p className="rdm-result__order">订单号：<span>{orderInfo.orderNo}</span></p>
                )}
                <p className="rdm-result__hint">以下是您兑换到的卡密，请妥善保存：</p>
                <ul className="rdm-card-detail-list">
                    {cards.map((card, i) => <CardDetail key={i} card={card} index={cards.length > 1 ? i : undefined} />)}
                </ul>
                <button className="cdk-form__btn rdm-reset-btn" onClick={handleReset}>再次兑换</button>
            </div>
        );
    }

    // ── 发卡中 / 错误 ──
    if (orderInfo && !cards) {
        return (
            <div className="rdm-polling rdm-fade-in">
                {pollError ? (
                    <>
                        <div className="rdm-polling__icon">⚠️</div>
                        <p className="rdm-polling__error">{pollError}</p>
                        {orderInfo.orderNo && (
                            <p className="rdm-result__order" style={{ textAlign: 'center' }}>
                                订单号：<span>{orderInfo.orderNo}</span>
                            </p>
                        )}
                        <button className="cdk-form__btn rdm-reset-btn" onClick={handleReset}>返回重试</button>
                    </>
                ) : (
                    <>
                        <div className="rdm-spinner" />
                        <p className="rdm-polling__label">{pollStatus || '发卡中...'}</p>
                        <p className="rdm-polling__hint">发卡系统处理中，请稍候，请勿关闭页面</p>
                        {orderInfo.orderNo && (
                            <p className="rdm-result__order">订单号：<span>{orderInfo.orderNo}</span></p>
                        )}
                    </>
                )}
            </div>
        );
    }

    // ── 兑换码已使用：显示历史记录 ──
    if (usedRecord) {
        const histCards = usedRecord.cards || [];
        const cardCount = histCards.length || usedRecord.quantity || 0;
        return (
            <div className="rdm-panel rdm-fade-in">
                <div className="rdm-used-banner">
                    <span className="rdm-used-icon">ℹ️</span>
                    <span className="rdm-used-msg">{usedRecord.message || '兑换码已使用完'}</span>
                </div>

                {/* 基本信息 */}
                <div className="rdm-used-info">
                    {usedRecord.productName && (
                        <div className="rdm-product-row">
                            <span className="rdm-product-label">商品名称</span>
                            <span className="rdm-product-value">{usedRecord.productName}</span>
                        </div>
                    )}
                    {usedRecord.quantity !== undefined && (
                        <div className="rdm-product-row">
                            <span className="rdm-product-label">兑换数量</span>
                            <span className="rdm-product-value">x{usedRecord.quantity}</span>
                        </div>
                    )}
                    {cardCount > 0 && (
                        <div className="rdm-product-row">
                            <span className="rdm-product-label">已发卡数</span>
                            <span className="rdm-product-value rdm-card-count">{cardCount} 张</span>
                        </div>
                    )}
                    {usedRecord.orderNo && (
                        <div className="rdm-product-row">
                            <span className="rdm-product-label">订单号</span>
                            <span className="rdm-product-value" style={{ fontSize: '0.78rem' }}>{usedRecord.orderNo}</span>
                        </div>
                    )}
                </div>

                {/* 查看已开卡记录按钮 */}
                {histCards.length > 0 && (
                    <button
                        className="rdm-view-cards-btn"
                        onClick={() => setShowUsedCards(v => !v)}
                    >
                        📋 {showUsedCards ? '收起' : `查看已开卡记录 (${histCards.length} 张)`}
                    </button>
                )}

                {showUsedCards && (
                    <ul className="rdm-card-detail-list rdm-fade-in">
                        {histCards.map((card, i) => <CardDetail key={i} card={card} index={histCards.length > 1 ? i : undefined} />)}
                    </ul>
                )}

                <button className="cdk-form__btn rdm-reset-btn" onClick={handleReset}>
                    兑换其他码
                </button>
            </div>
        );
    }

    // ── 主表单 ──
    return (
        <div className="rdm-panel rdm-fade-in">
            {/* Step 1 */}
            <div className={`cdk-form rdm-step ${productInfo ? 'rdm-step--done' : ''}`}>
                <div className="rdm-step-label">
                    <span className="rdm-step-num">1</span>
                    验证兑换码
                    {productInfo && <span className="rdm-step-check">✔</span>}
                </div>
                <form onSubmit={handleValidate}>
                    <div className="cdk-form__input-group">
                        <input
                            className="cdk-form__input"
                            type="text"
                            placeholder="请输入兑换码，如 XXXX-XXXX-XXXX-XXXX"
                            value={code}
                            onChange={e => { setCode(e.target.value); setProductInfo(null); setUsedRecord(null); }}
                            disabled={!!productInfo}
                        />
                        <button
                            type="submit"
                            className="cdk-form__btn"
                            disabled={validating || !!productInfo}
                        >
                            {validating ? <span className="cdk-form__spinner" /> : '验证'}
                        </button>
                    </div>
                    {validateError && (
                        <div className="cdk-form__error">
                            <span className="cdk-form__error-icon">⚠</span>{validateError}
                        </div>
                    )}
                </form>

                {productInfo && (
                    <div className="rdm-product-info rdm-fade-in">
                        <div className="rdm-product-row">
                            <span className="rdm-product-label">商品名称</span>
                            <span className="rdm-product-value">{productInfo.productName || '—'}</span>
                        </div>
                        <div className="rdm-product-row">
                            <span className="rdm-product-label">可兑换数量</span>
                            <span className="rdm-product-value">{productInfo.quantity ?? '—'}</span>
                        </div>
                        {productInfo.remainingQuantity !== undefined && (
                            <div className="rdm-product-row">
                                <span className="rdm-product-label">剩余库存</span>
                                <span className="rdm-product-value">{productInfo.remainingQuantity}</span>
                            </div>
                        )}
                        {productInfo.expireTime && (
                            <div className="rdm-product-row">
                                <span className="rdm-product-label">过期时间</span>
                                <span className="rdm-product-value">{productInfo.expireTime}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            className="rdm-change-btn"
                            onClick={() => setProductInfo(null)}
                        >更换兑换码</button>
                    </div>
                )}
            </div>

            {/* Step 2 */}
            {productInfo && (
                <div className="cdk-form rdm-step rdm-mt rdm-fade-in">
                    <div className="rdm-step-label">
                        <span className="rdm-step-num">2</span>
                        填写兑换信息
                    </div>
                    <form onSubmit={handleSubmit}>
                        <label className="rdm-field-label">联系邮箱 <span className="rdm-required">*</span></label>
                        <input
                            className="cdk-form__input rdm-full-input"
                            type="email"
                            placeholder="用于接收兑换结果通知"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                        {productInfo.quantity > 1 && (
                            <>
                                <label className="rdm-field-label" style={{ marginTop: '0.75rem' }}>兑换数量</label>
                                <input
                                    className="cdk-form__input"
                                    style={{ width: '100px' }}
                                    type="number"
                                    min={1}
                                    max={productInfo.quantity}
                                    value={quantity}
                                    onChange={e => setQuantity(Number(e.target.value))}
                                />
                            </>
                        )}
                        {submitError && (
                            <div className="cdk-form__error" style={{ marginTop: '0.75rem' }}>
                                <span className="cdk-form__error-icon">⚠</span>{submitError}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="cdk-form__btn rdm-submit-btn"
                            disabled={submitting}
                        >
                            {submitting ? <span className="cdk-form__spinner" /> : '确认兑换'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CdkVerify — 主页面（含标签切换）
───────────────────────────────────────────────────────────────────────────── */
export default function CdkVerify() {
    const [activeTab, setActiveTab] = useState('verify'); // 'verify' | 'redeem'

    return (
        <div className="cdk-page">
            <div className="cdk-container">
                {/* 页头 */}
                <header className="cdk-header">
                    <div className="cdk-header__icon">🔐</div>
                    <h1 className="cdk-header__title">POI 技术社区</h1>
                    <p className="cdk-header__subtitle">数字资产交付 · 凭证验证系统</p>
                </header>

                {/* 标签切换 */}
                <div className="cdk-tabs">
                    <button
                        className={`cdk-tab ${activeTab === 'verify' ? 'cdk-tab--active' : ''}`}
                        onClick={() => setActiveTab('verify')}
                    >
                        🔑 CDK 验证
                    </button>
                    <button
                        className={`cdk-tab ${activeTab === 'redeem' ? 'cdk-tab--active' : ''}`}
                        onClick={() => setActiveTab('redeem')}
                    >
                        🎁 卡密兑换
                    </button>
                </div>

                {/* 内容区 */}
                {activeTab === 'verify' ? (
                    <SecureContentLoader />
                ) : (
                    <RedeemPanel />
                )}
            </div>
        </div>
    );
}
