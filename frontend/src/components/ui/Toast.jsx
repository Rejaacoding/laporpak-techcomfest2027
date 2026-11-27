import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { buildToastPayload } from "../../lib/humanize.js";

const TOAST_STYLES = {
  success: {
    Icon: CheckCircle2,
    boxClass:
      "bg-green-50 text-green-800 border-green-200 [[data-theme=slate]_&]:bg-green-950/90 [[data-theme=slate]_&]:text-green-200 [[data-theme=slate]_&]:border-green-800",
  },
  warning: {
    Icon: AlertTriangle,
    boxClass:
      "bg-amber-50 text-amber-900 border-amber-200 [[data-theme=slate]_&]:bg-amber-950/90 [[data-theme=slate]_&]:text-amber-200 [[data-theme=slate]_&]:border-amber-800",
  },
  error: {
    Icon: XCircle,
    boxClass:
      "bg-red-50 text-red-800 border-red-200 [[data-theme=slate]_&]:bg-red-950/90 [[data-theme=slate]_&]:text-red-200 [[data-theme=slate]_&]:border-red-800",
  },
  info: {
    Icon: Info,
    boxClass:
      "bg-sky-50 text-sky-900 border-sky-200 [[data-theme=slate]_&]:bg-sky-950/90 [[data-theme=slate]_&]:text-sky-200 [[data-theme=slate]_&]:border-sky-800",
  },
};

const ToastContext = createContext({
  showToast: () => {},
  dismissToast: () => {},
});

/**
 * ToastProvider (docs/design.md §6.10)
 * Top-right on desktop, top-center on mobile, 5s auto-dismiss.
 * Runs error payloads through Kamus Bahasa Manusia so raw HTTP codes never leak.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", title, message, error, duration = 5000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const payload = buildToastPayload({ type, title, message, error });

      setToasts((prev) => [
        ...prev.slice(-3),
        { id, type: payload.type, title: payload.title, message: payload.message },
      ]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          const Icon = style.Icon;
          return (
            <div
              key={toast.id}
              role={toast.type === "error" ? "alert" : "status"}
              className={[
                "pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-lg [[data-theme=slate]_&]:shadow-none",
                "transition duration-200 ease-out motion-reduce:transition-none",
                style.boxClass,
              ].join(" ")}
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="font-head font-semibold text-sm leading-snug">
                    {toast.title}
                  </p>
                )}
                {toast.message && (
                  <p className="text-sm font-medium leading-snug">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Tutup notifikasi"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
