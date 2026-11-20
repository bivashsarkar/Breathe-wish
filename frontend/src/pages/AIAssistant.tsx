import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  CircleAlert,
  Copy,
  Database,
  Feather,
  Leaf,
  Lock,
  MessageCircleMore,
  RefreshCw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wind,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Notice from "../components/common/Notice";
import MarkdownText from "../components/common/MarkdownText";
import AppIcon from "../components/common/AppIcon";
import { useAir } from "../context/AirContext";
import { useApiHealth } from "../hooks/useApiHealth";
import { askAssistant } from "../services/assistantService";
import { getApiErrorMessage } from "../services/api";
import { formatAqi, formatNumber, formatUpdated } from "../lib/format";
import { levelStyle } from "../lib/aqi";
import { cn } from "../lib/cn";
import type { AssistantMessage } from "../types";

const QUICK_PROMPTS = [
  "Is it safe to go outside today?",
  "When should I exercise?",
  "How can I protect my family from smog?",
  "What can I do to improve indoor air quality?",
  "How can I reduce my pollution footprint?",
];

const MODE_META = {
  gemini: { label: "Gemini · grounded", tone: "mint" as const },
  demo: { label: "Demo guidance · rule engine", tone: "amber" as const },
  fallback: { label: "Offline guidance · rule engine", tone: "amber" as const },
};

export default function AIAssistant() {
  const { air, location, demoMode, error: airError } = useAir();
  const { health } = useApiHealth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const categoryStyle = levelStyle(air?.current.category.level);
  const modeLabel = health
    ? health.features.geminiConfigured
      ? "Gemini connected"
      : "Demo mode · no API key"
    : "Checking AI status…";

  const sendMessage = useCallback(
    async (raw: string, options?: { appendUser?: boolean }) => {
      const prompt = raw.trim();
      if (prompt.length < 2 || sending) return;
      if (prompt.length > 1000) {
        setError("Please keep your question under 1,000 characters.");
        return;
      }
      const appendUser = options?.appendUser !== false;
      let history = messages;
      if (!appendUser && history.length > 0) {
        // A retry must not send the failed question twice in the conversation history.
        const last = history[history.length - 1];
        if (last.role === "user" && last.content === prompt) {
          history = history.slice(0, -1);
        }
      }
      const userMessage: AssistantMessage = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `user-${Date.now()}`,
        role: "user",
        content: prompt,
      };

      if (appendUser) setMessages((previous) => [...previous, userMessage]);
      setInput("");
      setError(null);
      setFailedPrompt(null);
      setSending(true);
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      try {
        const response = await askAssistant(
          {
            message: prompt,
            history,
            latitude: location.latitude,
            longitude: location.longitude,
            locationName: location.label || location.name,
            demo: demoMode,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setMessages((previous) => [
          ...previous,
          {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `assistant-${Date.now()}`,
            role: "assistant",
            content: response.reply,
            mode: response.mode,
            notice: response.notice,
            disclaimer: response.disclaimer,
            groundedOn: response.groundedOn,
            createdAt: response.generatedAt,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(err));
        setFailedPrompt(prompt);
      } finally {
        if (!controller.signal.aborted) setSending(false);
      }
    },
    [demoMode, location.label, location.latitude, location.longitude, messages, sending],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const copyMessage = async (message: AssistantMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1800);
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  };

  const clearConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setFailedPrompt(null);
    setSending(false);
  };

  const introText = useMemo(() => {
    if (!air) {
      return "Hi — I'm BreatheWise. I can help you plan around air pollution, protect your family and improve indoor air. Live conditions have not loaded yet, but I will use whatever data the backend can retrieve.";
    }
    return `Hi — I'm BreatheWise. Air quality in ${air.location.name} is currently AQI ${formatAqi(
      air.current.aqi,
    )} (${air.current.category.label}). Ask me about going outside, exercise timing, family protection, indoor air or lowering your footprint. I only use live or clearly labelled demo data.`;
  }, [air]);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Grounded AI guidance"
        title="Ask about the air before you plan your day."
        description="BreatheWise combines live Open-Meteo data with Gemini — or a transparent rule engine when no API key is configured. No invented AQI values, no medical diagnoses."
        actions={
          <>
            <Badge tone={air?.meta.isDemo ? "amber" : "mint"} dot>
              {air?.meta.isDemo ? "Demo dataset" : "Live environmental data"}
            </Badge>
            <Link
              to="/planner"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-forest-100 bg-white px-4 text-sm font-semibold text-forest-900 shadow-sm transition hover:border-mint-300"
            >
              <Feather size={15} aria-hidden="true" />
              Build my daily plan
            </Link>
          </>
        }
      />

      {demoMode || air?.meta.isDemo ? (
        <Notice tone="warning" title="Demo-safe demonstration">
          {demoMode
            ? "Demo mode is on. Environmental values are clearly labelled illustrative data, not live measurements."
            : "The air-quality values on screen are a labelled demo dataset. AI answers will be grounded in that data and flagged accordingly."}
        </Notice>
      ) : null}

      {airError && !air ? (
        <Notice tone="warning" title="Live conditions are unavailable">
          {airError} You can still ask questions, but the assistant may be unable to retrieve current
          conditions. Try refreshing the dashboard first.
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="flex min-h-[600px] flex-col overflow-hidden xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-50 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-900 text-mint-300">
                <MessageCircleMore size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">BreatheWise Assistant</p>
                <p className="text-[10px] text-ink/40">
                  {location.name} · updated {formatUpdated(air?.meta.fetchedAt)}
                </p>
              </div>
            </div>
            {messages.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearConversation}
                icon={<Trash2 size={13} aria-hidden="true" />}
              >
                Clear chat
              </Button>
            ) : null}
          </div>

          <div
            ref={listRef}
            className="subtle-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:max-h-[560px] sm:px-5"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={sending}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest-800">
                <Sparkles size={15} aria-hidden="true" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-forest-100 bg-forest-50/60 px-4 py-3 text-[13px] leading-relaxed text-ink/70">
                {introText}
                {air?.insights.bestOutdoorWindow ? (
                  <p className="mt-2 text-[12px] font-medium text-forest-700">
                    Cleanest daylight window: {air.insights.bestOutdoorWindow.startLabel}–
                    {air.insights.bestOutdoorWindow.endLabel} (avg AQI{" "}
                    {Math.round(air.insights.bestOutdoorWindow.averageAqi)}).
                  </p>
                ) : null}
              </div>
            </div>

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-forest-900 px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest-800">
                    <Sparkles size={15} aria-hidden="true" />
                  </div>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-forest-100 bg-white px-4 py-3 shadow-sm">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge
                        tone={MODE_META[message.mode ?? "demo"]?.tone ?? "amber"}
                        className="px-2 py-0.5 text-[9px]"
                      >
                        {MODE_META[message.mode ?? "demo"]?.label ?? "Grounded guidance"}
                      </Badge>
                      {message.groundedOn?.aqi !== null && message.groundedOn?.aqi !== undefined ? (
                        <span className="text-[9px] text-ink/35">
                          AQI {message.groundedOn.aqi} · {message.groundedOn.location}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void copyMessage(message)}
                        aria-label={copiedId === message.id ? "Reply copied" : "Copy assistant reply"}
                        className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-ink/30 transition hover:bg-forest-50 hover:text-forest-700"
                      >
                        {copiedId === message.id ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          <Copy size={12} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <MarkdownText text={message.content} />
                    {message.notice ? (
                      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10.5px] leading-relaxed text-amber-800 ring-1 ring-amber-100">
                        {message.notice}
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}

            {sending ? (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest-800">
                  <Sparkles size={15} aria-hidden="true" />
                </div>
                <div className="rounded-2xl rounded-tl-md border border-forest-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5" aria-label="Assistant is thinking">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-forest-300"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                    <span className="ml-2 text-[11px] text-ink/40">Checking the live data…</span>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="rounded-2xl border border-red-100 bg-red-50/70 p-3.5">
                <div className="flex items-start gap-2">
                  <CircleAlert size={15} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-red-900">The assistant could not answer</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-red-800/70">{error}</p>
                  </div>
                </div>
                {failedPrompt ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2.5"
                    onClick={() => void sendMessage(failedPrompt, { appendUser: false })}
                    icon={<RefreshCw size={13} aria-hidden="true" />}
                  >
                    Try that question again
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-forest-50 bg-white px-4 pb-4 pt-3 sm:px-5">
            {messages.length === 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Suggested questions">
                {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={sending}
                    className="rounded-full border border-forest-100 bg-white px-2.5 py-1 text-[10.5px] font-medium text-ink/55 transition hover:border-mint-300 hover:text-forest-800 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
            <label htmlFor="assistant-input" className="sr-only">
              Ask the BreatheWise assistant
            </label>
            <div className="relative">
              <textarea
                id="assistant-input"
                rows={1}
                value={input}
                maxLength={1000}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about outdoor safety, exercise timing, family protection, indoor air…"
                aria-describedby="assistant-input-help"
                className="field max-h-32 min-h-[46px] resize-none py-3 pr-14"
              />
              <button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={sending || input.trim().length < 2}
                aria-label="Send question"
                className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-forest-900 text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:bg-forest-200 disabled:text-forest-600"
              >
                <SendHorizontal size={16} aria-hidden="true" />
              </button>
            </div>
            <div
              id="assistant-input-help"
              className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-ink/35"
            >
              <span>Enter to send · Shift + Enter for a new line</span>
              <span>{input.length}/1000</span>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink/35">
              <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              General environmental guidance, not medical advice. Answers are grounded in the data shown on
              this page and clearly labelled when Gemini is unavailable.
            </p>
          </div>
        </Card>

        <aside className="space-y-4 xl:col-span-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Today's context</p>
              {air?.meta.isDemo ? <Badge tone="amber">Demo</Badge> : <Badge tone="mint" dot>Live</Badge>}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-[-0.05em] text-ink">
                {air ? formatAqi(air.current.aqi) : "—"}
              </span>
              <span className={cn("mb-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", categoryStyle.badge)}>
                {air?.current.category.label ?? "Unavailable"}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-ink/45">{air?.location.name ?? location.label}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-forest-50/60 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-ink/35">PM2.5</p>
                <p className="mt-1 font-semibold text-ink">
                  {air?.current.pollutants.pm2_5
                    ? `${formatNumber(air.current.pollutants.pm2_5.displayValue, 1)} µg/m³`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-forest-50/60 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-ink/35">Weather</p>
                <p className="mt-1 font-semibold text-ink">
                  {air?.current.weather
                    ? `${Math.round(air.current.weather.temperature ?? 0)}°C · ${air.current.weather.condition}`
                    : "—"}
                </p>
              </div>
            </div>

            {air?.insights.bestOutdoorWindow ? (
              <div className="mt-3 rounded-xl bg-mint-50 p-3">
                <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-forest-600">
                  <Wind size={11} aria-hidden="true" />
                  Cleanest window
                </p>
                <p className="mt-1 text-sm font-semibold text-forest-900">
                  {air.insights.bestOutdoorWindow.startLabel} – {air.insights.bestOutdoorWindow.endLabel}
                </p>
                <p className="mt-0.5 text-[10px] text-forest-700/60">
                  Forecast average AQI {Math.round(air.insights.bestOutdoorWindow.averageAqi)}
                </p>
              </div>
            ) : null}

            <p className="mt-3 text-[10px] leading-relaxed text-ink/35">
              {air?.meta.attribution ?? "Live data by Open-Meteo."}
            </p>
          </Card>

          <Card className="p-5">
            <p className="eyebrow">Try asking</p>
            <div className="mt-3 space-y-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={sending}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-[11.5px] font-medium text-ink/60 transition hover:border-forest-100 hover:bg-forest-50/60 hover:text-forest-900 disabled:opacity-50"
                >
                  {prompt}
                  <span aria-hidden="true" className="text-ink/25">↗</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="eyebrow">How answers work</p>
            <ul className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-ink/50">
              <li className="flex gap-2">
                <Database size={13} className="mt-0.5 shrink-0 text-forest-500" aria-hidden="true" />
                The backend supplies real AQI, pollutant and weather data with each question.
              </li>
              <li className="flex gap-2">
                <Lock size={13} className="mt-0.5 shrink-0 text-forest-500" aria-hidden="true" />
                The Gemini key stays on the server and is never sent to this browser.
              </li>
              <li className="flex gap-2">
                <Leaf size={13} className="mt-0.5 shrink-0 text-forest-500" aria-hidden="true" />
                {modeLabel}. Answers are labelled so you always know which engine responded.
              </li>
            </ul>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => {
                const prompt = QUICK_PROMPTS[0];
                void sendMessage(prompt);
              }}
              disabled={sending}
              icon={<MessageCircleMore size={13} aria-hidden="true" />}
            >
              Start with outdoor safety
            </Button>
          </Card>

          <p className="flex items-start gap-2 rounded-2xl bg-forest-50/50 px-4 py-3 text-[10px] leading-relaxed text-ink/40">
            <AppIcon name="shield" size={13} className="mt-0.5 shrink-0" />
            Health guidance is general and based on public-health recommendations. It is not a diagnosis.
            Anyone with symptoms should consult a qualified health professional.
          </p>
        </aside>
      </div>
    </div>
  );
}
