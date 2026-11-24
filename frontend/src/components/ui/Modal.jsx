import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible Modal / Mobile Bottom Sheet (docs/design.md §6.10)
 * - Mobile: bottom sheet (rounded-t-3xl)
 * - Desktop: centered dialog (rounded-2xl max-w-md)
 * - Esc closes unless blocking=true; focus trapped inside while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  blocking = false,
  className = "",
  children,
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const firstFocusable = panel.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || panel).focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !blocking) {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key === "Tab" && panel) {
        const focusables = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, blocking, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-200 ease-out motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => {
          if (!blocking) onClose?.();
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={[
          "relative z-10 w-full max-w-md bg-surface text-fg border border-line",
          "rounded-t-3xl sm:rounded-2xl p-6 shadow-xl [[data-theme=slate]_&]:shadow-none",
          "max-h-[90vh] overflow-y-auto",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          "focus:outline-none",
          className,
        ].join(" ")}
      >
        {(title || !blocking) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              {title && (
                <h2
                  id={titleId}
                  className="font-head font-semibold text-xl leading-snug text-fg"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            {!blocking && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup dialog"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition duration-150 motion-reduce:transition-none cursor-pointer"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
