import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  GitBranch,
  Leaf,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { Brand } from './Brand';
import { Avatar } from './Avatar';
import { Github } from './icons';
import { useApp } from '../state/AppProvider';
import { ApiError } from '../lib/api';
import { cx } from '../lib/utils';

export function Onboarding() {
  const { user, demo, createDataRepo, connectRepo, signOut } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'connect'>('create');
  const [name, setName] = useState('meal-planner-data');
  const [isPrivate, setIsPrivate] = useState(true);
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await createDataRepo({ name: name.trim() || undefined, private: isPrivate });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the repository.');
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectRepo(fullName.trim());
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not connect that repository.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <header className="onboarding__top">
        <Brand />
        <div className="onboarding__account">
          {user && (
            <span className="onboarding__user">
              <Avatar name={user.name || user.login} src={user.avatarUrl} size={28} />
              @{user.login}
            </span>
          )}
          {!demo && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      </header>

      <main className="onboarding__main">
        <div className="onboarding__intro">
          <span className="eyebrow">
            <Sparkles size={13} /> One last step
          </span>
          <h1>Your recipes need a home.</h1>
          <p>
            Mise keeps everything in a GitHub repository you own — recipes, weekly plans and grocery
            lists as plain JSON. GitHub is the database, so every edit is a commit you can inspect,
            restore or export.
          </p>

          <ul className="onboarding__points">
            <li>
              <span className="point-icon"><GitBranch size={16} /></span>
              <div>
                <strong>Versioned by default</strong>
                <span>Every save is a commit. Roll back a bad edit in seconds.</span>
              </div>
            </li>
            <li>
              <span className="point-icon"><Lock size={16} /></span>
              <div>
                <strong>Private if you want</strong>
                <span>Create a private repo so only you can see your meal plans.</span>
              </div>
            </li>
            <li>
              <span className="point-icon"><ShieldCheck size={16} /></span>
              <div>
                <strong>No separate database</strong>
                <span>The Worker talks to GitHub with your OAuth token. Nothing else stores your data.</span>
              </div>
            </li>
          </ul>

          <div className="onboarding__sample">
            <span className="onboarding__sample-label">Inside the repo</span>
            <code>data/recipes.json</code>
            <code>data/plans.json</code>
            <code>data/lists.json</code>
          </div>
        </div>

        <div className="onboarding__card">
          <div className="segmented" role="tablist" aria-label="Data repository setup">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              className={cx('segmented__item', mode === 'create' && 'is-active')}
              onClick={() => { setMode('create'); setError(null); }}
            >
              Create new
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'connect'}
              className={cx('segmented__item', mode === 'connect' && 'is-active')}
              onClick={() => { setMode('connect'); setError(null); }}
            >
              Connect existing
            </button>
          </div>

          {mode === 'create' ? (
            <div className="onboarding__form">
              <h2>Create a data repository</h2>
              <p className="muted">
                Mise will create it in your GitHub account and seed it with a starter recipe box and
                this week’s plan.
              </p>

              <label className="field">
                <span className="field__label">Repository name</span>
                <span className="input-prefix">
                  <span>{user?.login ?? 'you'}/</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="meal-planner-data"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => setIsPrivate(event.target.checked)}
                />
                <span>
                  <strong>Make it private</strong>
                  <span>Recommended — meal plans stay yours.</span>
                </span>
              </label>

              {error && <p className="form-error">{error}</p>}

              <button type="button" className="btn btn--primary btn--wide" onClick={() => void handleCreate()} disabled={busy}>
                {busy ? <Loader2 size={17} className="spin" /> : <Github size={17} />}
                {busy ? 'Creating repository…' : 'Create my data repository'}
              </button>
              <p className="onboarding__fineprint">
                Uses your GitHub token with the <code>repo</code> scope. The token stays encrypted in an
                HttpOnly cookie on this Worker.
              </p>
            </div>
          ) : (
            <div className="onboarding__form">
              <h2>Connect an existing repository</h2>
              <p className="muted">
                Already have a Mise data repo, or want to keep it somewhere else? Enter it below. You
                need push access.
              </p>

              <label className="field">
                <span className="field__label">Repository</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="your-name/meal-planner-data"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              {error && <p className="form-error">{error}</p>}

              <button
                type="button"
                className="btn btn--primary btn--wide"
                onClick={() => void handleConnect()}
                disabled={busy || fullName.trim().length < 3}
              >
                {busy ? <Loader2 size={17} className="spin" /> : <ArrowRight size={17} />}
                {busy ? 'Connecting…' : 'Connect repository'}
              </button>

              <div className="onboarding__tip">
                <UtensilsCrossed size={16} />
                <p>
                  An empty repository works too — after connecting, load the starter recipe box from
                  the Recipes page.
                </p>
              </div>
            </div>
          )}

          <div className="onboarding__checks">
            <span><Check size={13} /> Recipes</span>
            <span><Check size={13} /> Weekly plans</span>
            <span><Check size={13} /> Grocery lists</span>
            <span><Leaf size={13} /> Still yours</span>
          </div>
        </div>
      </main>
    </div>
  );
}
