import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/layout/AppLayout';

// Eager: auth pages (small, needed immediately)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

// Lazy: route-level code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const StoragePage = lazy(() => import('./pages/StoragePage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const ToolPage = lazy(() => import('./pages/ToolPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={null}><DashboardPage /></Suspense>} />
          <Route path="projects" element={<Suspense fallback={null}><ProjectsPage /></Suspense>} />
          <Route path="workspace/:projectId" element={<Suspense fallback={null}><WorkspacePage /></Suspense>} />
          <Route path="storage" element={<Suspense fallback={null}><StoragePage /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={null}><BillingPage /></Suspense>} />
          <Route path="tools/background-removal" element={<Suspense fallback={null}><ToolPage toolSlug="background-removal" /></Suspense>} />
          <Route path="tools/scene-composition" element={<Suspense fallback={null}><ToolPage toolSlug="scene-composition" /></Suspense>} />
          <Route path="tools/model-dressing" element={<Suspense fallback={null}><ToolPage toolSlug="model-dressing" /></Suspense>} />
          <Route path="tools/detail-page" element={<Suspense fallback={null}><ToolPage toolSlug="detail-page" /></Suspense>} />
          <Route path="gallery" element={<Suspense fallback={null}><GalleryPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={null}><SettingsPage /></Suspense>} />
          <Route path="admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}