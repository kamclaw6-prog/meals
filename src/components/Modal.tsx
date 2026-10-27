import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/utils';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bodyClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) dialog.close();
      };
    }

    if (dialog.open) dialog.close();
    return undefined;
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cx('modal', `modal--${size}`)}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal__panel" onClick={(event) => event.stopPropagation()}>
        {(title || description) && (
          <header className="modal__head">
            <div>
              {title && (
                <h2 id={titleId} className="modal__title">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="modal__description">
                  {description}
                </p>
              )}
            </div>
            <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>
        )}
        <div className={cx('modal__body', bodyClassName)}>{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
