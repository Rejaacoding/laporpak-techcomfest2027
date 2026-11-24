/**
 * Skeleton Loader components (docs/design.md §6.5 & §7 CLS < 0.1)
 * Always respects motion-reduce:animate-none.
 */
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-2 animate-pulse motion-reduce:animate-none rounded-xl ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={`h-4 ${idx === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function TicketCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat laporan"
      className="bg-surface border border-line rounded-2xl p-4 md:p-6 space-y-3"
    >
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function MapSkeleton({ className = "h-72 md:h-96" }) {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat peta wilayah"
      className={`relative w-full overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
    >
      <Skeleton className="h-full w-full rounded-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-surface/90 border border-line px-4 py-2 text-sm font-medium text-fg-muted">
          Memuat peta Surabaya & Sidoarjo...
        </span>
      </div>
    </div>
  );
}
