import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ClientLayout from './components/ClientLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const TutorialDetail = lazy(() => import('./pages/TutorialDetail'));
const CdkVerify = lazy(() => import('./pages/CdkVerify'));

// Admin pages
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ArticleList = lazy(() => import('./pages/admin/ArticleList'));
const ArticleEditor = lazy(() => import('./pages/admin/ArticleEditor'));
const SiteSettings = lazy(() => import('./pages/admin/SiteSettings'));
const AboutEditor = lazy(() => import('./pages/admin/AboutEditor'));
const NavEditor = lazy(() => import('./pages/admin/NavEditor'));

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', width: '100%' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Client Routes */}
        <Route path="/" element={<ClientLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="tutorial/:id" element={<TutorialDetail />} />
        </Route>

        {/* Admin Login (public) */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* CDK Verify Landing Page (public, standalone) */}
        <Route path="/verify" element={<CdkVerify />} />

        {/* Admin Routes — protected by JWT token */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="articles" element={<ArticleList />} />
          <Route path="editor/new" element={<ArticleEditor />} />
          <Route path="editor/:id" element={<ArticleEditor />} />
          <Route path="settings" element={<SiteSettings />} />
          <Route path="about" element={<AboutEditor />} />
          <Route path="navigation" element={<NavEditor />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
