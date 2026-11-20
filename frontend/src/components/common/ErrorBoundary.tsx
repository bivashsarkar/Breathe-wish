import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the console useful for developers without shipping a tracking SDK.
    console.error("BreatheWise UI error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-cream px-6">
          <div className="w-full max-w-md rounded-3xl border border-forest-100 bg-white p-8 text-center shadow-soft">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <TriangleAlert size={22} aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">
              The interface hit an unexpected error. Reloading usually fixes it; your saved data stays in
              this browser.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white transition hover:bg-forest-800"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Reload BreatheWise
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
