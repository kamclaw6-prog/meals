import { useState } from 'react';
import { initials } from '../lib/utils';

export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={src ?? ''} alt="" width={size} height={size} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span className="avatar__fallback">{initials(name)}</span>
      )}
    </span>
  );
}
