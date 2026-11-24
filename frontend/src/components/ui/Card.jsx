import { forwardRef } from "react";

const DENSITY_PADDING = {
  warga: "p-4 md:p-6",
  dinas: "p-3",
  none: "p-0",
};

/**
 * Civic Tactical Card (docs/design.md §5 & §6.3)
 * Uses border + shadow-sm in light themes, border-only in slate theme.
 */
export const Card = forwardRef(function Card(
  {
    density = "warga",
    interactive = false,
    className = "",
    children,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={[
        "bg-surface border border-line rounded-2xl text-fg",
        "shadow-sm [[data-theme=slate]_&]:shadow-none",
        DENSITY_PADDING[density] || DENSITY_PADDING.warga,
        interactive
          ? "cursor-pointer transition duration-150 ease-out motion-reduce:transition-none hover:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ as: Component = "h3", className = "", children, ...props }) {
  return (
    <Component
      className={`font-head font-semibold text-lg leading-snug text-fg ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`text-sm md:text-base text-fg ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div
      className={`mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
