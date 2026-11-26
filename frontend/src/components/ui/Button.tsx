import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "danger-outline"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonDensity = "warga" | "dinas" | "icon" | "icon-dinas";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Size scale aligned to Figma UI Kit: sm (36px), md (44px), lg (48px) */
  size?: ButtonSize;
  /** Legacy density prop supported for existing pages */
  density?: ButtonDensity;
  loading?: boolean;
  /** Visible explanation rendered below disabled button (docs/design.md §6.2) */
  disabledReason?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-fg hover:brightness-110 active:brightness-95 border border-transparent",
  secondary:
    "bg-surface border border-line text-fg hover:bg-surface-2 active:bg-surface-2/80",
  outline:
    "bg-transparent border border-brand text-brand hover:bg-brand-soft/60 active:bg-brand-soft",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-transparent",
  "danger-outline":
    "bg-surface border border-red-600 text-red-700 hover:bg-red-50 [[data-theme=slate]_&]:text-red-300 [[data-theme=slate]_&]:border-red-500/60 [[data-theme=slate]_&]:hover:bg-red-500/15",
  ghost:
    "bg-transparent text-brand hover:bg-brand-soft active:bg-brand-soft/80 border border-transparent",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-1.5 text-[13px] leading-[18px] gap-1.5",
  md: "min-h-11 px-[18px] py-2 text-sm leading-5 gap-2",
  lg: "min-h-12 px-[22px] py-2.5 text-base leading-[22px] gap-2",
};

const DENSITY_CLASSES: Record<ButtonDensity, string> = {
  warga: "min-h-12 px-5 py-2.5 text-base gap-2",
  dinas: "min-h-12 md:min-h-9 px-3.5 py-2 md:py-1.5 text-sm gap-1.5",
  icon: "size-12 p-0",
  "icon-dinas": "size-12 md:size-9 p-0",
};

/**
 * Civic Tactical Button — aligned with Figma "03 — Core Components (UI Kit)" Button Component Set.
 * Supports primary, secondary, outline, danger, danger-outline, ghost and sizes sm / md / lg.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size,
    density,
    loading = false,
    disabled = false,
    disabledReason,
    leftIcon,
    rightIcon,
    type = "button",
    className = "",
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  const sizingClass = size
    ? SIZE_CLASSES[size]
    : density
      ? DENSITY_CLASSES[density]
      : SIZE_CLASSES.lg;

  return (
    <div className={disabledReason ? "inline-flex flex-col" : "contents"}>
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={[
          "inline-flex items-center justify-center rounded-xl font-head font-semibold",
          "transition duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "cursor-pointer select-none whitespace-nowrap",
          VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
          sizingClass,
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <Loader2
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          leftIcon && (
            <span className="inline-flex shrink-0" aria-hidden="true">
              {leftIcon}
            </span>
          )
        )}
        {children}
        {!loading && rightIcon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
      {isDisabled && disabledReason && (
        <p className="mt-1.5 text-xs text-fg-muted leading-snug">
          {disabledReason}
        </p>
      )}
    </div>
  );
});

export default Button;
