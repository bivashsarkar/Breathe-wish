import {
  CalendarDays,
  Database,
  Home,
  LayoutDashboard,
  Leaf,
  MessageCircleMore,
  Sparkles,
  Users,
  Wind,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAir } from "../../context/AirContext";
import { styleForCategory } from "../../lib/aqi";
import { formatAqi } from "../../lib/format";
import { cn } from "../../lib/cn";

const MENU_ITEMS = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, end: true },
  { name: "AI Assistant", path: "/assistant", icon: MessageCircleMore, end: false },
  { name: "Daily Planner", path: "/planner", icon: CalendarDays, end: false },
  { name: "Family Protection", path: "/family", icon: Users, end: false },
  { name: "Indoor Protection", path: "/indoor", icon: Home, end: false },
  { name: "My Impact", path: "/impact", icon: Leaf, end: false },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { air, demoMode, openPicker } = useAir();
  const categoryStyle = styleForCategory(air?.current.category);
  const tip =
    air?.insights.ventilationAdvice ??
    "Live data will appear here once your dashboard connects to Open-Meteo.";

  return (
    <div className="grid-pattern flex h-full w-[272px] flex-col bg-gradient-to-b from-forest-950 via-forest-900 to-[#062a1f] text-white">
      <div className="flex items-start justify-between px-6 pb-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-300 text-forest-950 shadow-lg shadow-black/20">
            <Wind size={23} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[17px] font-bold leading-tight tracking-[-0.03em]">BreatheWise</p>
            <p className="text-[11px] font-medium text-mint-200/60">Clean air companion</p>
          </div>
        </div>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-mint-100/60 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint-200/45">
          Workspace
        </p>
      </div>

      <nav aria-label="Primary" className="mt-3 flex-1 px-3">
        <ul className="space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition duration-200",
                      isActive
                        ? "bg-mint-300 text-forest-950 shadow-md shadow-black/15"
                        : "text-mint-50/70 hover:bg-white/[0.07] hover:text-white",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={18}
                        strokeWidth={isActive ? 2.2 : 1.9}
                        className={cn(isActive ? "text-forest-900" : "text-mint-200/60 group-hover:text-mint-200")}
                        aria-hidden="true"
                      />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 px-4 pb-5">
        <button
          type="button"
          onClick={openPicker}
          aria-label={`Change location. Current air in ${air?.location.name ?? "your location"}.`}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 text-left transition hover:border-mint-300/30 hover:bg-white/[0.1]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mint-200/50">
              Current air
            </span>
            {demoMode ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                <Database size={9} aria-hidden="true" />
                Demo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-mint-300/70">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-300" aria-hidden="true" />
                Live
              </span>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-semibold leading-none tracking-tight">
                {air ? formatAqi(air.current.aqi) : "—"}
              </p>
              <p className="mt-1 truncate text-[11px] text-mint-100/55">
                {air?.location.name ?? "Awaiting data"}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-bold",
                categoryStyle.badge.replace("ring-1", "ring-0"),
              )}
            >
              {air?.current.category.label ?? "Loading"}
            </span>
          </div>
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mint-200/50">
            <Sparkles size={11} aria-hidden="true" />
            Today's clean-air tip
          </p>
          <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-mint-50/70">{tip}</p>
        </div>

        <p className="px-1 text-[9.5px] leading-relaxed text-mint-200/25">
          Live data by Open-Meteo · CC BY 4.0
        </p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
      <SidebarContent />
    </aside>
  );
}
