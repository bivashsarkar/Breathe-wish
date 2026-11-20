import { LoaderCircle, Wind } from "lucide-react";

/** Branded suspense fallback used while a route chunk loads. */
export default function PageLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-900 text-mint-300 shadow-lift">
        <Wind size={26} aria-hidden="true" />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
          <LoaderCircle size={13} className="animate-spin text-forest-600" aria-hidden="true" />
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-ink">BreatheWise</p>
        <p className="mt-0.5 text-xs text-ink/45">Loading your clean-air workspace…</p>
      </div>
    </div>
  );
}
