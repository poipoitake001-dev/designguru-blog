import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute — wraps admin routes requiring authentication.
 * If no token is stored, redirect the user to /admin/login.
 */
export default function ProtectedRoute({ children }) {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        return <Navigate to="/admin/login" replace />;
    }
    return children;
}
