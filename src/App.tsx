import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Onboarding } from './components/Onboarding';
import { ErrorScreen, NotFoundPage, Splash } from './components/Splash';
import { GroceryPage } from './pages/GroceryPage';
import { LoginPage } from './pages/LoginPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipesPage } from './pages/RecipesPage';
import { SettingsPage } from './pages/SettingsPage';
import { WeekPage } from './pages/WeekPage';
import { useApp } from './state/AppProvider';

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[mise] render failed', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <ErrorScreen
          message="The interface hit an unexpected error. Reloading usually fixes it — your data is safe in GitHub."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

function AppRoutes() {
  const { status, errorMessage, repo, refresh } = useApp();
  const location = useLocation();

  if (status === 'loading') {
    return <Splash />;
  }

  if (status === 'error') {
    return <ErrorScreen message={errorMessage} onRetry={() => void refresh()} />;
  }

  // Render the sign-in screen at the current URL so the OAuth round trip can
  // bring the visitor back to the page they were trying to open.
  if (status === 'unauth') {
    return <LoginPage />;
  }

  if (!repo?.exists) {
    return <Onboarding />;
  }

  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WeekPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/:recipeId" element={<RecipeDetailPage />} />
        <Route path="grocery" element={<GroceryPage />} />
        <Route path="grocery/:listId" element={<GroceryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <AppRoutes />
    </AppErrorBoundary>
  );
}
