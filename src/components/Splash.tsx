import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Brand, BrandMark } from './Brand';

export function Splash({ label = 'Setting the table…' }: { label?: string }) {
  return (
    <div className="splash">
      <div className="splash__mark">
        <BrandMark size={54} />
      </div>
      <p className="splash__label">{label}</p>
      <div className="splash__bar" aria-hidden="true"><span /></div>
    </div>
  );
}

export function ErrorScreen({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="error-screen">
      <Brand to={undefined} />
      <div className="error-screen__card">
        <span className="error-screen__icon"><AlertTriangle size={22} /></span>
        <h1>We could not open your kitchen</h1>
        <p>{message ?? 'Something went wrong while talking to GitHub. Your data is safe — nothing was deleted.'}</p>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="page not-found">
      <span className="eyebrow">404</span>
      <h1 className="page-title">This page is not on the menu.</h1>
      <p className="page-sub">The link may be old, or the recipe was moved.</p>
      <a className="btn btn--primary" href="/">Back to this week</a>
    </div>
  );
}
