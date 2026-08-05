import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import WorkspacePage from './pages/WorkspacePage';
import StoragePage from './pages/StoragePage';
import BillingPage from './pages/BillingPage';
import ToolPage from './pages/ToolPage';
import GalleryPage from './pages/GalleryPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="workspace/:projectId" element={<WorkspacePage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="tools/background-removal" element={<ToolPage toolSlug="background-removal" />} />
          <Route path="tools/scene-composition" element={<ToolPage toolSlug="scene-composition" />} />
          <Route path="tools/model-dressing" element={<ToolPage toolSlug="model-dressing" />} />
          <Route path="tools/detail-page" element={<ToolPage toolSlug="detail-page" />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}