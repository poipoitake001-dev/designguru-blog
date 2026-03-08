import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function ClientLayout() {
    return (
        <div className="client-layout">
            <Navbar />
            <main className="client-main" style={{ paddingTop: '80px', minHeight: '100vh', paddingBottom: '3rem' }}>
                <Outlet />
            </main>
        </div>
    );
}
