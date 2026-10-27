import { Link } from 'react-router-dom';
import { cx } from '../lib/utils';

export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="brand-mark"
      focusable="false"
    >
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path d="M14 36h36c0 9.4-7.6 17-17.9 17S14 45.4 14 36Z" fill="#faf6ee" />
      <path d="M10 36h44" stroke="#faf6ee" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M26 26c-3.8-2.6-3.8-6.4 0-9M33 26c-3.8-2.6-3.8-6.4 0-9M40 26c-3.8-2.6-3.8-6.4 0-9"
        stroke="#faf6ee"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Brand({
  to = '/',
  compact = false,
  className,
}: {
  to?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <BrandMark size={compact ? 32 : 40} />
      <span className="brand__text">
        <span className="brand__name">Mise</span>
        {!compact && <span className="brand__tag">meal planning</span>}
      </span>
    </>
  );

  if (!to) return <div className={cx('brand', className)}>{content}</div>;

  return (
    <Link to={to} className={cx('brand', className)} aria-label="Mise — home">
      {content}
    </Link>
  );
}
