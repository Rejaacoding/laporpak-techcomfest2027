import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const VARIANT_CLASSES = {
  primary:
    "bg-brand text-brand-fg hover:brightness-110 active:brightness-95",
  secondary:
    "bg-surface border border-line text-fg hover:bg-surface-2",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  "danger-outline":
    "bg-surface border border-red-600 text-red-700 hover:bg-red-50 [[data-theme=slate]_&]:text-red-300 [[data-theme=slate]_&]:border-red-500/60 [[data-theme=slate]_&]:hover:bg-red-500/15",
  ghost:
    "bg-transparent text-brand hover:bg-brand-soft",
};

const DENSITY_CLASSES = {
  warga: "min-h-12 px-5 py-2.5 text-base gap-2",
  dinas: "min-h-12 md:min-h-9 px-3.5 py-2 md:py-1.5 text-sm gap-1.5",
  icon: "size-12 p-0",
  "icon-dinas": "size-12 md:size-9 p-0",
};

/**
 * Civic Tactical Button (docs/design.md §6.2)
 * Supports loading spinner (prevents double-click/409) and visible disabledReason for mobile.
 */
export const Button = forwardRef(function Button(
  {
    variant = "primary",
    density = "warga",
    loading = false,
    disabled = false,
    disabledReason,
    type = "button",
    className = "",
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <div className={disabledReason ? "inline-flex flex-col" : "contents"}>
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={[
          "inline-flex items-center justify-center rounded-xl font-semibold",
          "transition duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "cursor-pointer select-none",
          VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
          DENSITY_CLASSES[density] || DENSITY_CLASSES.warga,
          className,
        ].join(" ")}
        {...props}
      >
        {loading && (
          <Loader2
            className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
      {isDisabled && disabledReason && (
        <p className="mt-1.5 text-xs text-fg-muted leading-snug">
          {disabledReason}
        </p>
      )}
    </div>
  );
});
