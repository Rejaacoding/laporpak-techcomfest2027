import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

export type InputDensity = "warga" | "dinas";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label rendered above the field (docs/design.md §6.7) */
  label?: string;
  /** Optional state badge aligned to right of label */
  labelHint?: string;
  helperText?: string;
  error?: string;
  density?: InputDensity;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  wrapperClassName?: string;
}

/**
 * Civic Tactical Input — aligned with Figma "03 — Core Components (UI Kit)" Form Inputs.
 * - min-h-12 (48px) warga default, min-h-10 (40px) dense dinas
 * - rounded-xl (12px), focus ring-2 ring-brand ring-offset-2
 * - Error state renders AlertCircle icon + role="alert" message below field
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    labelHint,
    helperText,
    error,
    density = "warga",
    leftIcon,
    rightElement,
    disabled = false,
    className = "",
    wrapperClassName = "",
    ...props
  },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const heightClass =
    density === "dinas" ? "min-h-10 text-sm leading-5" : "min-h-12 text-base leading-6";

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {(label || labelHint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={inputId}
              className={[
                "font-sans font-semibold text-sm leading-5",
                disabled ? "text-fg-muted" : "text-fg",
              ].join(" ")}
            >
              {label}
            </label>
          )}
          {labelHint && (
            <span className="font-mono font-medium text-[11px] leading-4 text-fg-muted">
              {labelHint}
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span
            className="pointer-events-none absolute left-3.5 inline-flex text-fg-muted"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={[
            "w-full rounded-xl font-sans transition duration-150 ease-out motion-reduce:transition-none",
            "placeholder:text-fg-muted/70",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            heightClass,
            leftIcon ? "pl-10" : "pl-4",
            rightElement ? "pr-11" : "pr-4",
            error
              ? "bg-semantic-error-soft border-[1.5px] border-red-600 text-fg focus-visible:ring-red-600"
              : disabled
                ? "bg-surface-2 border border-line text-fg-muted opacity-65 cursor-not-allowed"
                : "bg-surface border border-line text-fg hover:border-brand/60",
            className,
          ].join(" ")}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-2 flex items-center">{rightElement}</div>
        )}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-semantic-error"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        helperText && (
          <p id={helperId} className="text-xs leading-4 text-fg-muted">
            {helperText}
          </p>
        )
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  /** Optional character counter display (e.g., minChars=15 for Tolak Spam / Oper) */
  minChars?: number;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id,
    label,
    helperText,
    error,
    minChars,
    value,
    disabled = false,
    className = "",
    wrapperClassName = "",
    rows = 3,
    ...props
  },
  ref
) {
  const autoId = useId();
  const areaId = id || autoId;
  const errorId = `${areaId}-error`;
  const helperId = `${areaId}-helper`;

  const currentLength = typeof value === "string" ? value.length : 0;
  const meetsMinimum = minChars !== undefined ? currentLength >= minChars : true;

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {(label || minChars !== undefined) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={areaId}
              className={[
                "font-sans font-semibold text-sm leading-5",
                disabled ? "text-fg-muted" : "text-fg",
              ].join(" ")}
            >
              {label}
            </label>
          )}
          {minChars !== undefined && (
            <span
              className={[
                "font-mono font-bold text-[11px] leading-4 tabular-nums",
                meetsMinimum ? "text-semantic-success" : "text-fg-muted",
              ].join(" ")}
            >
              {currentLength} / {minChars} karakter
            </span>
          )}
        </div>
      )}

      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={[
          "w-full rounded-xl px-3.5 py-3 font-sans text-sm md:text-base leading-5",
          "transition duration-150 ease-out motion-reduce:transition-none",
          "placeholder:text-fg-muted/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          error
            ? "bg-semantic-error-soft border-[1.5px] border-red-600 text-fg focus-visible:ring-red-600"
            : disabled
              ? "bg-surface-2 border border-line text-fg-muted opacity-65 cursor-not-allowed"
              : "bg-surface border border-line text-fg hover:border-brand/60",
          className,
        ].join(" ")}
        {...props}
      />

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-semantic-error"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        helperText && (
          <p id={helperId} className="text-xs leading-4 text-fg-muted">
            {helperText}
          </p>
        )
      )}
    </div>
  );
});

export default Input;
