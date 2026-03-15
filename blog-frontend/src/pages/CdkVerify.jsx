import React from 'react';
import SecureContentLoader from '../components/SecureContentLoader';
import './CdkVerify.css'; // Just for page background and general layout

export default function CdkVerify() {
    return (
        <div className="cdk-page">
            <div className="cdk-container">
                {/* ─── 页头 ─── */}
                <header className="cdk-header">
                    <div className="cdk-header__icon">🔐</div>
                    <h1 className="cdk-header__title">POI 技术社区</h1>
                    <p className="cdk-header__subtitle">数字资产交付 · 凭证验证系统</p>
                </header>

                {/* ─── 核心组件：处理验证、倒计时、教程展示和客服 ─── */}
                <SecureContentLoader />
            </div>
        </div>
    );
}
