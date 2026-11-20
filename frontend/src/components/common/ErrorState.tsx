import { CircleAlert, RefreshCw, WandSparkles } from "lucide-react";

import Button from "./Button";
import { cn } from "../../lib/cn";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDemo?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}

export default function ErrorState({
  title = "We could not load live conditions",
  message,
  onRetry,
  onDemo,
  retrying = false,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-4 rounded-2xl border border-red-100 bg-red-50/60 p-5 sm:flex-row sm:items-center sm:justify-between",
        compact ? "" : "sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
          <CircleAlert size={18} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-red-900">{title}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-red-800/75">{message}</p>
          {onDemo ? (
            <p className="mt-1.5 text-xs text-red-800/60">
              You can still explore the product with clearly labelled demo data.
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {onRetry ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetry}
            loading={retrying}
            icon={<RefreshCw size={14} aria-hidden="true" />}
          >
            Try again
          </Button>
        ) : null}
        {onDemo ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDemo}
            icon={<WandSparkles size={14} aria-hidden="true" />}
          >
            Use demo data
          </Button>
        ) : null}
      </div>
    </div>
  );
}
