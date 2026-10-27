import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Cloud,
  Lock,
  LogOut,
  Moon,
  Settings,
  ShoppingBasket,
  Sparkles,
  Sun,
  MonitorSmartphone,
} from 'lucide-react';
import { Brand } from './Brand';
import { Avatar } from './Avatar';
import { Github } from './icons';
import { Spinner } from './ui';
import { useApp } from '../state/AppProvider';
import { useTheme } from '../state/ThemeProvider';
import { cx, relativeTime } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'This week', icon: CalendarDays, end: true },
  { to: '/recipes', label: 'Recipes', icon: BookOpen, end: false },
  { to: '/grocery', label: 'Grocery', icon: ShoppingBasket, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

function SyncStatus() {
  const { pending, lastSavedAt, demo } = useApp();

  if (demo) {
    return (
      <span className="sync-status">
        <span className="sync-status__dot sync-status__dot--demo" />
        Demo data
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span className="sync-status">
        <Spinner size={12} />
        Saving…
      </span>
    );
  }

  return (
    <span className="sync-status" title={lastSavedAt ? `Last saved ${relativeTime(lastSavedAt)}` : undefined}>
      <Cloud size={13} />
      Synced to GitHub
    </span>
  );
}

export function AppShell() {
  const { user, repo, demo, signOut } = useApp();
  const { theme, cycleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const themeIcon = theme === 'system' ? <MonitorSmartphone size={15} /> : theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />;
  const themeLabel = theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light';

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />

        <nav className="nav" aria-label="Main">
          <span className="nav__label">Kitchen</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cx('nav-link', isActive && 'is-active')}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__spacer" />

        {demo && (
          <div className="demo-note">
            <Sparkles size={15} />
            <div>
              <strong>Demo mode</strong>
              <span>Changes live in memory and reset when the Worker restarts.</span>
            </div>
          </div>
        )}

        {repo && (
          <div className="repo-card">
            <span className="repo-card__label">
              <Github size={13} /> Data repository
            </span>
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="repo-card__name"
              title="Open data repository on GitHub"
            >
              {repo.fullName}
            </a>
            <div className="repo-card__meta">
              <span>
                {repo.private ? <Lock size={11} /> : <Github size={11} />}
                {repo.private ? 'Private' : 'Public'}
              </span>
              <span className="repo-card__branch">{repo.branch}</span>
            </div>
            <SyncStatus />
          </div>
        )}

        <div className="sidebar__footer">
          <button type="button" className="theme-switch" onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Change theme`}>
            {themeIcon}
            <span>{themeLabel}</span>
          </button>
          {user && (
            <Link to="/settings" className="user-card" aria-label="Account settings">
              <Avatar name={user.name || user.login} src={user.avatarUrl} size={30} />
              <span className="user-card__text">
                <strong>{user.name || user.login}</strong>
                <small>@{user.login}</small>
              </span>
            </Link>
          )}
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Brand compact />
        <div className="topbar__actions">
          <SyncStatus />
          <button type="button" className="icon-btn" onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Change theme`}>
            {themeIcon}
          </button>
          {user && (
            <Link to="/settings" className="topbar__avatar" aria-label="Account settings">
              <Avatar name={user.name || user.login} src={user.avatarUrl} size={30} />
            </Link>
          )}
        </div>
      </header>

      <main className="main">
        {demo && (
          <div className="demo-banner">
            <Sparkles size={15} />
            <span>
              <strong>Demo mode.</strong> Changes are stored in memory for this Worker instance and reset on restart.
            </span>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx('bottom-nav__link', isActive && 'is-active')}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
