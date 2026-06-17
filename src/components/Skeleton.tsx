/** Skeleton loading placeholder */
export function SkeletonRow({ count = 3 }: { count?: number }) {
  return (
    <div className="w-full space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-black/20">
          <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-white/10 rounded w-3/4" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
          <div className="h-4 bg-white/10 rounded w-10" />
        </div>
      ))}
    </div>
  );
}
