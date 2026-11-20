import { useEffect, useRef, useState } from "react";
import {
  Baby,
  CircleCheck,
  CircleX,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  UserRound,
  PersonStanding,
  TriangleAlert,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Notice from "../components/common/Notice";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import { useAir } from "../context/AirContext";
import { getFamilyAdvice } from "../services/familyService";
import { getApiErrorMessage } from "../services/api";
import { readStored, writeStored } from "../lib/storage";
import { styleForCategory, RISK_STYLES } from "../lib/aqi";
import { formatAqi, formatUpdated, initials } from "../lib/format";
import { cn } from "../lib/cn";
import type { FamilyAdvice, FamilyMember, FamilyRelation } from "../types";

const FAMILY_KEY = "breathew.family.v1";

const RELATION_META: Record<
  FamilyRelation,
  { label: string; icon: typeof Baby; description: string }
> = {
  child: { label: "Child", icon: Baby, description: "Under 18" },
  adult: { label: "Adult", icon: UserRound, description: "18–64" },
  elderly: { label: "Older adult", icon: PersonStanding, description: "65+" },
};

const SAMPLE_MEMBERS: FamilyMember[] = [
  { id: "sample-child", name: "Aarav", relation: "child", age: 7, activity: "School and outdoor play" },
  { id: "sample-adult", name: "Rohan", relation: "adult", age: 36, activity: "Office commute" },
  { id: "sample-elderly", name: "Meera", relation: "elderly", age: 72, activity: "Morning walk" },
];

function loadMembers(): FamilyMember[] {
  const stored = readStored<unknown>(FAMILY_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is FamilyMember => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<FamilyMember>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      candidate.name.length > 0 &&
      (candidate.relation === "child" ||
        candidate.relation === "adult" ||
        candidate.relation === "elderly")
    );
  });
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function FamilyProtection() {
  const { air, location, demoMode } = useAir();
  const [members, setMembers] = useState<FamilyMember[]>(loadMembers);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<FamilyRelation>("child");
  const [age, setAge] = useState("");
  const [activity, setActivity] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<FamilyAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    writeStored(FAMILY_KEY, members);
  }, [members]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    getFamilyAdvice(
      {
        members,
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: location.label || location.name,
        demo: demoMode,
      },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setAdvice(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [demoMode, location.label, location.latitude, location.longitude, members, refreshKey]);

  const addMember = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setFormError("Please enter a name or nickname.");
      return;
    }
    if (trimmed.length > 40) {
      setFormError("Names must be 40 characters or fewer.");
      return;
    }
    if (age.trim()) {
      const parsedAge = Number(age);
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 120) {
        setFormError("Age must be a whole number between 0 and 120.");
        return;
      }
    }
    if (members.length >= 10) {
      setFormError("You can add up to 10 family members.");
      return;
    }
    const member: FamilyMember = {
      id: newId(),
      name: trimmed,
      relation,
      age: age.trim() ? Number(age) : null,
      activity: activity.trim() || null,
    };
    setMembers((previous) => [...previous, member]);
    setName("");
    setAge("");
    setActivity("");
    setFormError(null);
    setShowForm(false);
  };

  const removeMember = (id: string) => {
    setMembers((previous) => previous.filter((member) => member.id !== id));
  };

  const categoryStyle = styleForCategory(advice?.current.category ?? air?.current.category);
  const riskCount =
    advice?.members.filter((member) => ["high", "very-high"].includes(member.riskLevel)).length ?? 0;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Family protection"
        title="Protect the people who breathe with you."
        description="Add the people in your household and get age-appropriate, environment-grounded guidance. These are general precautions, never diagnoses."
        actions={
          <>
            <Badge tone={advice?.current.isDemo ? "amber" : "mint"} dot>
              {advice ? `AQI ${formatAqi(advice.current.aqi)} · ${advice.current.category.label}` : "Loading conditions"}
            </Badge>
            <Button
              variant="mint"
              onClick={() => setShowForm((value) => !value)}
              icon={<Plus size={15} aria-hidden="true" />}
            >
              {showForm ? "Hide form" : "Add family member"}
            </Button>
          </>
        }
      />

      {advice?.current.isDemo ? (
        <Notice tone="warning" title="Demo dataset in use">
          Advice is based on clearly labelled illustrative values, not live measurements. Switch off demo
          mode in the location picker to use live data.
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-5">
          {showForm ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-50 text-forest-700">
                  <Users size={17} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Add a household member</h2>
                  <p className="text-[10px] text-ink/40">Stored only in this browser.</p>
                </div>
              </div>

              <form
                className="mt-4 space-y-3.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  addMember();
                }}
              >
                <div>
                  <label htmlFor="family-name" className="field-label">
                    Name or nickname
                  </label>
                  <input
                    id="family-name"
                    className="field"
                    value={name}
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Aarav"
                    autoComplete="off"
                  />
                </div>

                <fieldset>
                  <legend className="field-label">Age group</legend>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(RELATION_META) as FamilyRelation[]).map((value) => {
                      const meta = RELATION_META[value];
                      const Icon = meta.icon;
                      return (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-[10px] font-semibold transition",
                            relation === value
                              ? "border-mint-300 bg-mint-50 text-forest-900 ring-1 ring-mint-200"
                              : "border-forest-100 text-ink/50 hover:border-mint-200",
                          )}
                        >
                          <input
                            type="radio"
                            name="relation"
                            value={value}
                            checked={relation === value}
                            onChange={() => setRelation(value)}
                            className="sr-only"
                          />
                          <Icon size={15} aria-hidden="true" />
                          {meta.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="family-age" className="field-label">
                      Age (optional)
                    </label>
                    <input
                      id="family-age"
                      type="number"
                      min={0}
                      max={120}
                      className="field"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder="7"
                    />
                  </div>
                  <div>
                    <label htmlFor="family-activity" className="field-label">
                      Usual activity
                    </label>
                    <input
                      id="family-activity"
                      className="field"
                      value={activity}
                      maxLength={40}
                      onChange={(event) => setActivity(event.target.value)}
                      placeholder="School, walk…"
                    />
                  </div>
                </div>

                {formError ? (
                  <p role="alert" className="text-[11px] font-medium text-red-600">
                    {formError}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" icon={<Plus size={15} aria-hidden="true" />}>
                  Add to household
                </Button>
              </form>
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Household</p>
                <h2 className="mt-1 text-sm font-semibold">
                  {members.length} {members.length === 1 ? "person" : "people"} protected
                </h2>
              </div>
              {riskCount > 0 ? (
                <Badge tone="red">
                  <TriangleAlert size={11} aria-hidden="true" />
                  {riskCount} higher risk
                </Badge>
              ) : (
                <Badge tone="mint" dot>
                  Monitoring
                </Badge>
              )}
            </div>

            {members.length === 0 ? (
              <EmptyState
                className="mt-4 border-0 bg-forest-50/40 py-8"
                icon={<Users size={20} aria-hidden="true" />}
                title="No profiles yet"
                description="Add children, adults and older adults to tailor the household guidance."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" onClick={() => setShowForm(true)} icon={<Plus size={13} aria-hidden="true" />}>
                      Add first member
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setMembers(SAMPLE_MEMBERS)}
                    >
                      Load sample family
                    </Button>
                  </div>
                }
              />
            ) : (
              <ul className="mt-4 space-y-2">
                {members.map((member) => {
                  const meta = RELATION_META[member.relation];
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-3 rounded-2xl border border-forest-100/80 bg-white p-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-[11px] font-bold text-forest-700">
                        {initials(member.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{member.name}</p>
                        <p className="truncate text-[10px] text-ink/40">
                          {meta.label}
                          {member.age !== null && member.age !== undefined ? ` · ${member.age}` : ""}
                          {member.activity ? ` · ${member.activity}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        aria-label={`Remove ${member.name}`}
                        title={`Remove ${member.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/30 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {members.length > 0 && members.length < 10 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowForm(true)}
                  icon={<Plus size={13} aria-hidden="true" />}
                >
                  Add another
                </Button>
                {members.length < 3 ? (
                  <Button size="sm" variant="ghost" onClick={() => setMembers(SAMPLE_MEMBERS)}>
                    Load sample family
                  </Button>
                ) : null}
              </div>
            ) : null}

            <p className="mt-3 text-[10px] leading-relaxed text-ink/35">
              Profiles stay on this device. We do not ask for medical conditions or diagnoses. For any
              specific health concern, consult a clinician.
            </p>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-7">
          {error ? (
            <ErrorState
              title="Family advice is unavailable"
              message={error}
              onRetry={() => setRefreshKey((value) => value + 1)}
              retrying={loading}
            />
          ) : null}

          {loading && !advice ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading family advice">
              <div className="skeleton h-36 rounded-3xl" />
              <div className="skeleton h-44 rounded-3xl" />
              <div className="skeleton h-44 rounded-3xl" />
            </div>
          ) : null}

          {advice ? (
            <>
              <Card className="overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-forest-50 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="eyebrow">Household briefing</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", categoryStyle.badge)}>
                        {advice.current.category.label}
                      </span>
                      {advice.current.isDemo ? <Badge tone="amber">Demo</Badge> : null}
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold leading-snug">
                      {advice.summary}
                    </h2>
                    <p className="mt-1.5 text-[11px] text-ink/40">
                      {advice.location.name} · updated {formatUpdated(advice.generatedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-forest-900 px-4 py-3 text-center text-white">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-mint-200/60">US AQI</p>
                    <p className="mt-0.5 text-3xl font-semibold leading-none tracking-tight">
                      {formatAqi(advice.current.aqi)}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <ShieldCheck size={14} className="text-forest-600" aria-hidden="true" />
                    For the whole household
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {advice.household.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink/55">
                        <CircleCheck size={13} className="mt-0.5 shrink-0 text-mint-500" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              {members.length === 0 ? (
                <EmptyState
                  icon={<Users size={20} aria-hidden="true" />}
                  title="Household guidance is ready"
                  description="Add family members to see age-specific precautions. The household briefing above already applies to everyone."
                  action={
                    <Button size="sm" onClick={() => setShowForm(true)} icon={<Plus size={13} aria-hidden="true" />}>
                      Add a family member
                    </Button>
                  }
                />
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {advice.members.map((member) => {
                  const riskClass = RISK_STYLES[member.riskLevel] ?? RISK_STYLES.unknown;
                  return (
                    <Card key={member.id} className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-xs font-bold text-forest-700">
                            {initials(member.name)}
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-ink">{member.name}</h3>
                            <p className="text-[10px] text-ink/40">
                              {member.relationLabel}
                              {member.age !== null ? ` · ${member.age}` : ""}
                              {member.activity ? ` · ${member.activity}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold uppercase", riskClass)}>
                          {member.riskLevel.replace("-", " ")}
                        </span>
                      </div>

                      <p className="mt-3 text-[12px] font-semibold text-ink">{member.headline}</p>

                      <div className="mt-3 space-y-2">
                        {member.actions.map((action, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <CircleCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                            <p className="text-[11px] leading-relaxed text-ink/55">{action}</p>
                          </div>
                        ))}
                      </div>

                      {member.avoid.length > 0 ? (
                        <div className="mt-3 rounded-xl bg-red-50/60 p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-red-700/70">
                            Avoid today
                          </p>
                          <div className="mt-1 space-y-1">
                            {member.avoid.map((item, index) => (
                              <div key={index} className="flex items-start gap-1.5">
                                <CircleX size={11} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
                                <p className="text-[10px] leading-relaxed text-red-900/60">{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>

              <Notice tone="info" title="Important">
                {advice.disclaimer}
              </Notice>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
