import { Link } from "react-router-dom";
import { ArrowLeft, Compass, LayoutDashboard, MessageCircleMore } from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Card from "../components/common/Card";

export default function NotFound() {
  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="404 · Page not found"
        title="This page drifted away."
        description="The address you opened does not exist in BreatheWise. Your saved location, household profiles and impact log are unaffected."
      />

      <Card className="p-8 sm:p-10">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-600">
            <Compass size={26} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Let's get you back to cleaner air</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/50">
            Head to the dashboard for live conditions, or ask the assistant a question about today's air.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800"
            >
              <LayoutDashboard size={15} aria-hidden="true" />
              Go to dashboard
            </Link>
            <Link
              to="/assistant"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-forest-100 bg-white px-4 text-sm font-semibold text-forest-900 shadow-sm transition hover:border-mint-300"
            >
              <MessageCircleMore size={15} aria-hidden="true" />
              Ask the assistant
            </Link>
          </div>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink/40 transition hover:text-forest-700"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Back to safety
          </Link>
        </div>
      </Card>
    </div>
  );
}
