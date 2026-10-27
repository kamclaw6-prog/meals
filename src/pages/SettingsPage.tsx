import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Check,
  Database,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Lock,
  LogOut,
  MonitorSmartphone,
  Moon,
  ShieldCheck,
  ShoppingBasket,
  Sun,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { Github } from '../components/icons';
import { PageHeader } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { useTheme } from '../state/ThemeProvider';
import { useToast } from '../state/ToastProvider';
import { useDocumentTitle } from '../lib/hooks';
import { ApiError } from '../lib/api';
import { cx, plural } from '../lib/utils';
import type { ThemeChoice } from '../state/ThemeProvider';

const THEMES: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: MonitorSmartphone },
];

export function SettingsPage() {
  const { user, repo, demo, recipes, plans, lists, connectRepo, signOut } = useApp();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [repoOpen, setRepoOpen] = useState(false);
  const [fullName, setFullName] = useState(repo?.fullName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle('Settings');

  const openRepoDialog = () => {
    setFullName(repo?.fullName ?? '');
    setError(null);
    setRepoOpen(true);
  };

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    const value = fullName.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await connectRepo(value);
      setRepoOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not connect that repository.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast('Signed out.', 'success');
  };

  const dataFiles = repo
    ? [
        { path: 'data/recipes.json', label: 'Recipe box', count: plural(recipes.length, 'recipe'), icon: BookOpen },
        { path: 'data/plans.json', label: 'Meal plans', count: plural(plans.length, 'week'), icon: CalendarDays },
        { path: 'data/lists.json', label: 'Grocery lists', count: plural(lists.length, 'list'), icon: ShoppingBasket },
      ]
    : [];

  return (
    <div className="page">
      <PageHeader
        eyebrow={<><FolderGit2 size={13} /> Workspace</>}
        title="Settings"
        description="Your account, the GitHub repository behind everything, and how Mise looks."
      />

      <div className="settings-grid">
        <section className="settings-card">
          <header className="settings-card__head">
            <h2>Account</h2>
            <Github size={16} />
          </header>
          {user && (
            <div className="account-row">
              <Avatar name={user.name || user.login} src={user.avatarUrl} size={52} />
              <div className="account-row__text">
                <strong>{user.name || user.login}</strong>
                <span>@{user.login}</span>
                <a href={user.htmlUrl} target="_blank" rel="noreferrer noopener" className="inline-link">
                  View GitHub profile <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
          <p className="settings-card__text">
            Signing in with GitHub gives Mise a token with the <code>repo</code> scope. It is encrypted in
            an HttpOnly session cookie on this Worker — never stored in the browser's JavaScript or in a
            database.
          </p>
          {demo ? (
            <p className="settings-note">You are exploring the demo. Sign out is disabled; data resets when the Worker restarts.</p>
          ) : (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => void handleSignOut()}>
              <LogOut size={15} /> Sign out
            </button>
          )}
        </section>

        <section className="settings-card">
          <header className="settings-card__head">
            <h2>Data repository</h2>
            <GitBranch size={16} />
          </header>

          {repo ? (
            <>
              <a href={repo.htmlUrl} target="_blank" rel="noreferrer noopener" className="repo-big">
                <span className="repo-big__icon"><Github size={18} /></span>
                <span>
                  <strong>{repo.fullName}</strong>
                  <small>
                    {repo.private ? <><Lock size={11} /> Private</> : 'Public'} · branch {repo.branch}
                  </small>
                </span>
                <ExternalLink size={14} />
              </a>

              <dl className="meta-list">
                <div><dt>Visibility</dt><dd>{repo.private ? 'Private' : 'Public'}</dd></div>
                <div><dt>Branch</dt><dd><code>{repo.branch}</code></dd></div>
                <div><dt>Access</dt><dd>{repo.canWrite ? 'Read & write' : 'Read only'}</dd></div>
                <div><dt>Mode</dt><dd>{demo ? 'In-memory demo' : 'GitHub API'}</dd></div>
              </dl>

              <div className="settings-card__actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={openRepoDialog} disabled={demo}>
                  <FolderGit2 size={15} /> Change repository
                </button>
                <a href={repo.htmlUrl} target="_blank" rel="noreferrer noopener" className="btn btn--ghost btn--sm">
                  Open on GitHub <ExternalLink size={13} />
                </a>
              </div>
            </>
          ) : (
            <p className="muted">No repository connected yet.</p>
          )}
        </section>

        <section className="settings-card">
          <header className="settings-card__head">
            <h2>Appearance</h2>
            <Sun size={16} />
          </header>
          <p className="settings-card__text">Mise follows your system by default, or pick a side.</p>
          <div className="theme-options" role="group" aria-label="Theme">
            {THEMES.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cx('theme-option', theme === option.value && 'is-active')}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon size={17} />
                  <span>{option.label}</span>
                  {theme === option.value && <Check size={13} className="theme-option__check" />}
                </button>
              );
            })}
          </div>
          <p className="settings-card__text settings-card__text--quiet">
            Stored in this browser only. It never changes your data.
          </p>
        </section>

        <section className="settings-card">
          <header className="settings-card__head">
            <h2>How storage works</h2>
            <ShieldCheck size={16} />
          </header>
          <p className="settings-card__text">
            There is no Mise database. Every save is a commit to the repository above, which means
            history, diffs and a portable backup come free.
          </p>
          <ul className="file-list">
            {dataFiles.map((file) => {
              const Icon = file.icon;
              return (
                <li key={file.path}>
                  <span className="file-list__icon"><Icon size={15} /></span>
                  <span className="file-list__text">
                    <strong>{file.label}</strong>
                    <code>{file.path}</code>
                  </span>
                  <span className="file-list__count">{file.count}</span>
                  {repo && (
                    <a
                      href={`${repo.htmlUrl}/blob/${repo.branch}/${file.path}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Open ${file.path} on GitHub`}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="settings-note">
            <Database size={14} />
            <span>Editing these files by hand in GitHub works too — Mise validates on the next load.</span>
          </div>
        </section>
      </div>

      <footer className="settings-footer">
        <span>Mise · v1.0</span>
        <span>·</span>
        <span>Cloudflare Workers + GitHub</span>
        <span>·</span>
        <Link to="/" className="inline-link">Back to this week</Link>
      </footer>

      <Modal
        open={repoOpen}
        onClose={() => setRepoOpen(false)}
        title="Change data repository"
        description="Point Mise at another repo you can push to. Nothing is deleted from the current one."
        size="md"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setRepoOpen(false)}>Cancel</button>
            <button type="submit" form="repo-form" className="btn btn--primary" disabled={busy || !fullName.trim()}>
              {busy ? 'Connecting…' : 'Connect repository'}
            </button>
          </>
        }
      >
        <form id="repo-form" onSubmit={(event) => void handleConnect(event)}>
          <label className="field">
            <span className="field__label">Repository</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="owner/meal-planner-data"
              autoFocus
              spellCheck={false}
            />
            <span className="field__hint">Use the owner/name format. You need push access.</span>
          </label>
          {error && <p className="form-error">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
