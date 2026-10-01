/**
 * Suspense fallback while server data streams in. Shapes only — never placeholder numbers.
 * Used inside pages (after notFound checks) rather than as loading.tsx, so 404s keep their status.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <span className="sr-only">Đang tải dữ liệu…</span>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="skeleton h-7 w-48" />
        <div className="border border-outline-subtle bg-surface-low p-3">
          <div className="skeleton mb-3 h-4 w-40" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-9" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="hidden flex-col gap-4 xl:flex">
        <div className="skeleton h-56" />
        <div className="skeleton h-32" />
      </div>
    </div>
  );
}
