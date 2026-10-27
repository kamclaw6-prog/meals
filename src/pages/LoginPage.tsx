import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  GitBranch,
  Leaf,
  ListChecks,
  Lock,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { Github } from '../components/icons';

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Sign-in was cancelled on GitHub. Nothing was changed.',
  invalid_state: 'That sign-in link expired or was already used. Please start again.',
  exchange_failed: 'GitHub did not return an access token. Please try signing in again.',
  signin_failed: 'We could not finish signing you in. Please try again.',
  not_configured:
    'GitHub sign-in is not configured on this deployment yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then reload.',
};

export function LoginPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const error = params.get('error');
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Sign-in failed. Please try again.') : null;

  const returnTo = location.pathname.startsWith('/login')
    ? '/'
    : `${location.pathname}${location.search}`;
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="auth">
      <section className="auth__story">
        <header className="auth__header">
          <Brand to={undefined} />
          <span className="auth__pill">
            <Leaf size={13} /> A calmer kitchen
          </span>
        </header>

        <div className="auth__hero">
          <span className="eyebrow">
            <Sparkles size={13} /> Meal planning, minus the spreadsheet
          </span>
          <h1>
            Plan the week.
            <br />
            Shop once.
            <br />
            <em>Cook well.</em>
          </h1>
          <p className="auth__lede">
            Mise ties your recipe box to a weekly plan and a grocery list that builds itself. No
            scattered notes, no forgotten garlic.
          </p>

          <ul className="auth__features">
            <li>
              <span><CalendarDays size={17} /></span>
              <div>
                <strong>A week you can see</strong>
                <span>Breakfast to dinner, one calm board.</span>
              </div>
            </li>
            <li>
              <span><BookOpen size={17} /></span>
              <div>
                <strong>Recipes with memory</strong>
                <span>Scale servings, keep notes, cook again.</span>
              </div>
            </li>
            <li>
              <span><ShoppingBasket size={17} /></span>
              <div>
                <strong>One grocery list</strong>
                <span>Ingredients merge, grouped by aisle.</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="week-slip" aria-hidden="true">
          <div className="week-slip__head">
            <span>This week</span>
            <span className="week-slip__dot" />
          </div>
          <div className="week-slip__row">
            <span className="week-slip__day">Mon</span>
            <span className="week-slip__meal">Miso butter salmon</span>
            <span className="week-slip__tag">dinner</span>
          </div>
          <div className="week-slip__row">
            <span className="week-slip__day">Wed</span>
            <span className="week-slip__meal">Coconut chickpea curry</span>
            <span className="week-slip__tag">one-pot</span>
          </div>
          <div className="week-slip__row">
            <span className="week-slip__day">Sat</span>
            <span className="week-slip__meal">Shakshuka</span>
            <span className="week-slip__tag">brunch</span>
          </div>
          <div className="week-slip__foot">
            <ListChecks size={13} /> 32 items · 11 in the basket
          </div>
        </div>

        <footer className="auth__footer">
          <span>Runs on Cloudflare Workers</span>
          <span className="auth__footer-dot" />
          <span>Data lives in your GitHub repo</span>
        </footer>
      </section>

      <section className="auth__aside">
        <div className="auth-card">
          <div className="auth-card__mark">
            <Github size={26} />
          </div>
          <h2>Sign in to your kitchen</h2>
          <p className="auth-card__lede">Use GitHub — it is both your login and your database.</p>

          {errorMessage && (
            <div className="auth-alert" role="alert">
              {errorMessage}
            </div>
          )}

          <a className="btn btn--github btn--wide" href={loginHref}>
            <Github size={18} />
            Continue with GitHub
            <ArrowRight size={16} className="btn__end" />
          </a>

          <ul className="auth-card__list">
            <li>
              <Check size={14} /> Creates or connects a repository you own
            </li>
            <li>
              <Check size={14} /> Needs <code>repo</code> scope to save plans and lists
            </li>
            <li>
              <Lock size={14} /> Token kept in an encrypted, HttpOnly cookie
            </li>
          </ul>

          <details className="auth-card__details">
            <summary>Where does my data live?</summary>
            <p>
              Recipes, meal plans and grocery lists are stored as JSON in a GitHub repository — one
              commit per change. Mise has no database of its own, so you can leave whenever you like
              and take everything with you.
            </p>
            <p>
              <GitBranch size={13} /> <code>data/recipes.json</code>, <code>data/plans.json</code>,{' '}
              <code>data/lists.json</code>
            </p>
          </details>
        </div>

        <p className="auth__fineprint">
          Self-hosted on your Cloudflare account. <Link to="/login">Mise</Link> never sells your
          dinner plans.
        </p>
      </section>
    </div>
  );
}
