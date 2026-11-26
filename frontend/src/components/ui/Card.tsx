import { forwardRef } from "react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

export type CardDensity = "warga" | "dinas" | "none";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  density?: CardDensity;
  /** Interactive / Elevated card variant from Figma Frame 04 (border-brand + shadow-elevated) */
  interactive?: boolean;
  /** Surface tone: default white surface or warm secondary panel */
  tone?: "default" | "secondary";
}

const DENSITY_PADDING: Record<CardDensity, string> = {
  warga: "p-4 md:p-6",
  dinas: "p-3",
  none: "p-0",
};

/**
 * Civic Tactical Card — aligned with Figma "04 — Cards & Navigation"
 * Uses rounded-2xl (16px), border-line (#E7DFD3), shadow-card (default) and shadow-elevated (interactive).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    density = "warga",
    interactive = false,
    tone = "default",
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
        "border border-line rounded-2xl text-fg",
        tone === "secondary" ? "bg-surface-2" : "bg-surface",
        "shadow-card [[data-theme=slate]_&]:shadow-none",
        DENSITY_PADDING[density] || DENSITY_PADDING.warga,
        interactive
          ? "cursor-pointer transition duration-150 ease-out motion-reduce:transition-none hover:border-brand hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mb-3 flex items-start justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
}

export function CardTitle({
  as: Component = "h3",
  className = "",
  children,
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={`font-head font-semibold text-lg leading-6 text-fg ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`text-sm md:text-base text-fg ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
