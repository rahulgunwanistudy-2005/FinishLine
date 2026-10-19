import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  MousePointer2,
  Keyboard,
  AudioLines,
  Mic,
  ZoomIn,
  Smartphone,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Check,
  Flag,
  ChevronRight,
  ExternalLink,
  Link as LinkIcon,
  X,
  Copy,
  CheckCheck,
  Activity,
  ArrowUpRight,
  Search,
  Square,
  Info,
} from "lucide-react";
import {
  lanes,
  laneMeta,
  reasons,
  fixPrompt,
  KLM,
} from "../../../packages/core/model";
import type {
  Lane,
  LaneEvent,
  LaneResult,
  Race,
  JourneyStep,
} from "../../../packages/core";
import "./styles.css";
const icons = {
  mouse: MousePointer2,
  keyboard: Keyboard,
  screenreader: AudioLines,
  voice: Mic,
  zoom: ZoomIn,
  budget: Smartphone,
};
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "The request failed. Try again.");
  return data as T;
}
const stamp = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
function Brand() {
  return (
    <a className="brand" href="/" aria-label="Finish Line home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      Finish Line<span className="brand-point">.</span>
    </a>
  );
}
function App() {
  const pathname = location.pathname;
  const [health, setHealth] = useState<{ engine: { ok: boolean } }>();
  useEffect(() => {
    api<{ engine: { ok: boolean } }>("/api/health")
      .then(setHealth)
      .catch(() => {});
  }, []);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="/" aria-current={pathname === "/" ? "page" : undefined}>
            The race
          </a>
          <a
            href="/deploys"
            aria-current={pathname === "/deploys" ? "page" : undefined}
          >
            Deploy history
          </a>
          <a
            href="/method"
            aria-current={pathname === "/method" ? "page" : undefined}
          >
            Method & limits
          </a>
        </nav>
        <a className="header-action" href="/#race-your-site">
          Race your site <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        {pathname === "/method" ? (
          <Method />
        ) : pathname === "/deploys" ? (
          <Deploys />
        ) : (
          <Home
            raceId={
              pathname.startsWith("/race/") ? pathname.split("/")[2] : undefined
            }
            engineReady={health?.engine.ok}
          />
        )}
      </main>
      <footer>
        <Brand />
        <span>Push code. Everyone finishes.</span>
        <a href="/health" target="_blank" rel="noreferrer">
          System health <ExternalLink size={13} />
        </a>
      </footer>
    </>
  );
}
function Home({
  raceId,
  engineReady,
}: {
  raceId?: string;
  engineReady?: boolean;
}) {
  const [gate, setGate] = useState<{ regressions: Lane[] }>();
  const [benchmarks, setBenchmarks] = useState<Race[]>([]);
  const [selected, setSelected] = useState<Race>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    api<{ races: Race[] }>("/api/benchmark")
      .then((d) => {
        setBenchmarks(d.races);
        if (!raceId)
          setSelected(
            d.races.find((r) => r.title?.includes("original")) ?? d.races[0],
          );
      })
      .catch((e) => setError(e.message));
    if (raceId)
      api<Race>(`/api/races/${raceId}`)
        .then(setSelected)
        .catch((e) => setError(e.message));
  }, [raceId]);
  useEffect(() => {
    if (!selected || !["running", "queued"].includes(selected.status)) return;
    const source = new EventSource(`/api/races/${selected.id}/events`);
    source.addEventListener("snapshot", (e) => setSelected(JSON.parse(e.data)));
    source.addEventListener("progress", (e) => {
      const { lane, event } = JSON.parse(e.data) as {
        lane: Lane;
        event: LaneEvent;
      };
      setSelected((r) => {
        if (!r) return r;
        const prior = r.results.find((v) => v.lane === lane) ?? {
          lane,
          status: "unknown" as const,
          cost: { unit: laneMeta[lane].unit, value: 0 },
          estSeconds: 0,
          stoppedAtStep: null,
          reasonCode: null,
          wcag: [],
          events: [],
        };
        if (prior.events.some((v) => v.i === event.i)) return r;
        return {
          ...r,
          results: [
            ...r.results.filter((v) => v.lane !== lane),
            {
              ...prior,
              events: [...prior.events, event],
              cost: {
                ...prior.cost,
                value: prior.cost.value + event.costDelta,
              },
              estSeconds: prior.estSeconds + event.estSecondsDelta,
            },
          ],
        };
      });
    });
    source.addEventListener("lane", (e) => {
      const result = JSON.parse(e.data) as LaneResult;
      setSelected((r) =>
        r
          ? {
              ...r,
              results: [
                ...r.results.filter((v) => v.lane !== result.lane),
                result,
              ],
            }
          : r,
      );
    });
    source.addEventListener("done", (e) => {
      setSelected(JSON.parse(e.data));
      source.close();
      setNonce((n) => n + 1);
    });
    source.onerror = () => {
      source.close();
      api<Race>(`/api/races/${selected.id}`)
        .then(setSelected)
        .catch(() =>
          setError(
            "Live updates disconnected. Reload this race to check its result.",
          ),
        );
    };
    return () => source.close();
  }, [selected?.id, selected?.status]);
  useEffect(() => {
    if (selected?.source === "deploy" && selected.status === "done")
      api<{ regressions: Lane[] }>(`/api/deployxa/gate/${selected.id}`)
        .then(setGate)
        .catch(() => {});
    else setGate(undefined);
  }, [selected?.id, selected?.status]);
  async function runFixture() {
    setError("");
    setLoading(true);
    try {
      const { id } = await api<{ id: string }>(
        "/api/fixtures/bakery-original/race",
        { method: "POST", body: "{}" },
      );
      setSelected(await api<Race>(`/api/races/${id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <section className="intro">
        <div>
          <h1>
            Same checkout.
            <br />
            Six ways through.
          </h1>
          <p>
            One website. One journey. See where the experience
            <br className="desktop-break" /> works, and where it leaves someone
            behind.
          </p>
        </div>
        <div className="intro-note">
          <span className={`status-dot ${engineReady ? "online" : ""}`} />
          <span>
            {engineReady
              ? "Real browsers. Real barriers."
              : "Recorded races stay ready."}
            <small>Measured actions. Estimated human time.</small>
          </span>
        </div>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!!gate?.regressions.length && (
        <div className="error" role="alert">
          <strong>Don’t promote this deploy.</strong>{" "}
          {gate.regressions.map((l) => laneMeta[l].name).join(", ")} changed
          from Finish to DNF compared with the previous completed deployment
          race.
        </div>
      )}
      <RaceBoard
        race={selected}
        autoPlay={nonce > 0}
        key={`${selected?.id ?? "empty"}-${nonce}`}
        onLive={runFixture}
        loading={loading}
      />
      {!raceId && (
        <>
          <div className="below-track">
            <p>
              <Info size={15} /> A finish is a completed journey, not a WCAG
              certification.
            </p>
            <a href="/method">
              How we measure <ChevronRight size={15} />
            </a>
          </div>
          <section className="lower-grid">
            <div className="benchmarks">
              <div className="section-heading">
                <div>
                  <span className="section-number">01</span>
                  <h2>The starting field</h2>
                </div>
                <span className="subtle">Every result has a receipt.</span>
              </div>
              <p className="section-description">
                Controlled fixtures prove the engine. AI-builder benchmarks will
                appear here when the original stores and transcripts are
                supplied.
              </p>
              <div className="benchmark-table-wrap">
                <table className="benchmark-table">
                  <caption className="sr-only">Recorded test journeys</caption>
                  <thead>
                    <tr>
                      <th>Site / version</th>
                      <th>Finished</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarks.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setSelected(r);
                              setNonce(0);
                              window.scrollTo({
                                top: 120,
                                behavior: "instant",
                              });
                            }}
                          >
                            {r.title ?? new URL(r.url).hostname}
                            <ChevronRight size={14} />
                          </button>
                          <small>
                            {r.source === "self"
                              ? "Self-race"
                              : "Controlled fixture"}{" "}
                            · {stamp(r.createdAt)}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {
                              r.results.filter((v) => v.status === "finished")
                                .length
                            }
                            <span className="subtle">
                              {" "}
                              / {r.results.length}
                            </span>
                          </strong>
                        </td>
                        <td>
                          <a
                            className="evidence-link"
                            href={`/race/${r.id}`}
                            aria-label={`View run for ${r.title}`}
                          >
                            View run <ExternalLink size={13} />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {!benchmarks.length && (
                      <tr>
                        <td colSpan={3}>
                          No recordings yet. Run the controlled fixture to
                          create real browser evidence.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="pending-note">
                <span className="status-dot" /> Builder leaderboard awaiting
                original exports. No invented rankings.
              </p>
            </div>
            <JourneyPicker
              onCreated={(id) => {
                location.href = `/race/${id}`;
              }}
            />
          </section>
        </>
      )}
    </>
  );
}
type VisibleLane = {
  event?: LaneEvent;
  cost: number;
  seconds: number;
  progress: number;
  done: boolean;
};
function visibleResult(
  result: LaneResult | undefined,
  elapsed: number,
  stepCount: number,
  complete: boolean,
): VisibleLane {
  if (!result) return { cost: 0, seconds: 0, progress: 0, done: false };
  let time = 0;
  let cost = 0;
  let current: LaneEvent | undefined;
  for (const e of result.events) {
    time += e.estSecondsDelta;
    if (!complete && time > elapsed + 0.00001) break;
    cost += e.costDelta;
    current = e;
  }
  const done = Boolean(
    current && ["finish", "dnf", "unknown"].includes(current.kind),
  );
  let progress = 0;
  if (current) {
    const inStep = result.events.filter((e) => e.step === current!.step);
    const index = inStep.findIndex((e) => e.i === current!.i);
    progress =
      ((current.step +
        (current.kind === "finish"
          ? 1
          : current.kind === "activate"
            ? 0.9
            : Math.min(
                0.8,
                ((index + 1) / Math.max(1, inStep.length)) * 0.8,
              ))) /
        Math.max(1, stepCount)) *
      100;
  }
  return {
    event: current,
    cost,
    seconds: complete ? result.estSeconds : Math.min(elapsed, time),
    progress: result.status === "finished" && done ? 100 : progress,
    done,
  };
}
function RaceBoard({
  race,
  autoPlay,
  onLive,
  loading,
}: {
  race?: Race;
  autoPlay?: boolean;
  onLive: () => void;
  loading: boolean;
}) {
  const reduced = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [mode, setMode] = useState<"ready" | "playing" | "done">(
    autoPlay ? "playing" : "ready",
  );
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [detail, setDetail] = useState<Lane>();
  const [announcement, setAnnouncement] = useState("");
  const spoken = useRef(new Set<number>());
  const announced = useRef(new Set<Lane>());
  const lastAnnounced = useRef(0);
  const clockRef = useRef(0);
  clockRef.current = elapsed;
  const [copied, setCopied] = useState(false);
  const measuring = !!race && ["queued", "running"].includes(race.status);
  const duration = Math.max(
    1,
    ...(race?.results.map((r) => r.estSeconds) ?? []),
  );
  const play = useCallback(() => {
    window.speechSynthesis?.cancel();
    spoken.current.clear();
    announced.current.clear();
    setElapsed(0);
    setMode(reduced.current ? "done" : "playing");
  }, []);
  useEffect(() => {
    if (mode !== "playing") return;
    if (reduced.current) {
      setMode("done");
      return;
    }
    let raf = 0;
    let start: number | undefined;
    const frame = (now: number) => {
      start ??= now;
      const seconds = (now - start) / 1000;
      setElapsed(Math.min(seconds, duration));
      if (seconds >= duration) setMode("done");
      else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, duration]);
  useEffect(() => {
    if (mode !== "playing" || muted || !race) return;
    const result = race.results.find((r) => r.lane === "screenreader");
    if (!result) return;
    let t = 0;
    for (const event of result.events) {
      t += event.estSecondsDelta;
      if (t > elapsed) break;
      if (
        event.kind === "announce" &&
        event.text &&
        !spoken.current.has(event.i)
      ) {
        spoken.current.add(event.i);
        if ("speechSynthesis" in window) {
          const speech = new SpeechSynthesisUtterance(event.text);
          speech.rate = rate * 1.5;
          window.speechSynthesis.speak(speech);
        }
      }
    }
  }, [elapsed, mode, muted, rate, race]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if ((mode === "ready" && !measuring) || !race) return;
    const tick = () => {
      const next = race.results.find(
        (r) =>
          !announced.current.has(r.lane) &&
          (mode === "done" || measuring
            ? ["finish", "dnf", "unknown"].includes(r.events.at(-1)?.kind ?? "")
            : clockRef.current >= r.estSeconds),
      );
      if (next && Date.now() - lastAnnounced.current >= 1500) {
        announced.current.add(next.lane);
        lastAnnounced.current = Date.now();
        setAnnouncement(
          `${laneMeta[next.lane].name}: ${next.status === "finished" ? "finished" : next.status === "dnf" ? "did not finish" : "measurement unknown"}.`,
        );
      }
    };
    tick();
    const timer = setInterval(tick, 1500);
    return () => clearInterval(timer);
  }, [mode, race, measuring]);
  const done = mode === "done";
  const active = mode !== "ready" || measuring;
  const finished =
    race?.results.filter((r) => r.status === "finished").length ?? 0;
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/race/${race?.id}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setAnnouncement("Copy the race link from your address bar.");
    }
  }
  return (
    <section
      className={`race-console ${mode}`}
      aria-label="Six lane access race"
    >
      <div className="console-top">
        <div className="site-identity">
          <span className="site-thumbnail" aria-hidden="true">
            {race?.source === "self" ? "FL" : "cb"}
          </span>
          <div>
            <span className="console-label">
              {race?.title ?? "Corner bakery / controlled fixture"}
            </span>
            <span className="recording-kind">
              {race?.source === "self"
                ? "Finish Line self-race"
                : race?.source === "public"
                  ? "Public URL journey"
                  : "Controlled fixture"}{" "}
              <span className="divider">/</span>{" "}
              {measuring
                ? "Browser measurement in progress"
                : race
                  ? "Recorded browser run"
                  : "Ready to measure"}
            </span>
          </div>
        </div>
        <div className="console-actions">
          <button
            className="icon-button"
            aria-label={muted ? "Unmute announcements" : "Mute announcements"}
            aria-pressed={muted}
            onClick={() => {
              setMuted((v) => !v);
              window.speechSynthesis?.cancel();
            }}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <label className="speech-rate">
            <span className="sr-only">Speech speed</span>
            <select
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            >
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.5}>1.5×</option>
            </select>
          </label>
          <button
            className="primary start-button"
            disabled={measuring || loading}
            onClick={
              mode === "playing"
                ? () => {
                    setMode("done");
                    window.speechSynthesis?.cancel();
                  }
                : race
                  ? play
                  : onLive
            }
          >
            {mode === "playing" ? (
              <Square size={14} fill="currentColor" />
            ) : done ? (
              <RotateCcw size={17} />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {measuring
              ? race?.status === "queued"
                ? `Queued #${race.queuePosition}`
                : "Measuring…"
              : loading
                ? "Starting…"
                : mode === "playing"
                  ? "Show results"
                  : done
                    ? "Replay race"
                    : "Start race"}
          </button>
        </div>
      </div>
      <div className="journey-bar">
        <span>Journey</span>
        <ol>
          {(
            race?.journey ?? [
              { label: "Add to cart" },
              { label: "Open cart" },
              { label: "Checkout" },
            ]
          ).map((step, i) => (
            <li key={i}>
              <b>{i + 1}</b>
              {step.label}
              {i < (race?.journey.length ?? 3) - 1 && (
                <ChevronRight size={13} />
              )}
            </li>
          ))}
        </ol>
        <span className="journey-end">
          <Flag size={13} /> The same finish line
        </span>
      </div>
      <div className="track-heading">
        <span>Input method</span>
        <span>Journey progress</span>
        <span>Estimated time</span>
      </div>
      <p className="sr-only" id="lane-instructions">
        Select an input method to inspect its browser evidence.
      </p>
      <div className="track">
        {lanes.map((lane, index) => {
          const result = race?.results.find((r) => r.lane === lane);
          const visible = visibleResult(
            result,
            measuring ? Infinity : active ? elapsed : -1,
            race?.journey.length ?? 3,
            done || measuring,
          );
          const Icon = icons[lane];
          const status = visible.done
            ? result?.status
            : measuring && result
              ? "measured"
              : active
                ? "running"
                : "ready";
          return (
            <button
              key={lane}
              className={`lane lane-${lane} lane-${status}`}
              onClick={() => setDetail(lane)}
              aria-describedby="lane-instructions"
            >
              <span className="lane-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="lane-method">
                <span className="method-title">
                  <Icon size={18} />
                  <strong>{laneMeta[lane].name}</strong>
                </span>
                <span className="method-description">
                  {laneMeta[lane].short}
                </span>
              </span>
              <span className="lane-course">
                <span className="course-baseline" />
                <span className="course-ticks">
                  <i />
                  <i />
                  <i />
                </span>
                <span
                  className="course-fill"
                  style={{ width: `${visible.progress}%` }}
                />
                <span
                  className="runner"
                  style={{ left: `${Math.min(97, visible.progress)}%` }}
                >
                  <Icon size={17} />
                </span>
                {visible.done && result?.status !== "finished" && (
                  <span
                    className={`verdict-stamp ${result?.status === "unknown" ? "unknown" : ""}`}
                    style={{ left: `${Math.min(68, visible.progress + 5)}%` }}
                  >
                    {result?.status === "dnf" ? "DNF" : "Unknown"}
                  </span>
                )}
                <span className="lane-caption">
                  {lane === "screenreader" && visible.event?.kind === "announce"
                    ? `“${visible.event.text}”`
                    : lane === "voice" && visible.event?.kind === "command"
                      ? `“${visible.event.text}”`
                      : visible.done && result?.status !== "finished"
                        ? visible.event?.text
                        : visible.event?.kind === "activate"
                          ? visible.event.text
                          : !active
                            ? "Waiting at the start"
                            : visible.done
                              ? "Across the line"
                              : (visible.event?.text ??
                                "Waiting for the first event")}
                </span>
                <span className="finish-line" />
              </span>
              <span className="lane-score">
                <strong>
                  {active ? `${visible.seconds.toFixed(1)}` : "—"}
                  <small>{active ? "s" : ""}</small>
                </strong>
                <span>
                  {active
                    ? `${fmt(visible.cost)} ${laneMeta[lane].unit}`
                    : "Ready"}
                </span>
              </span>
              <span className={`lane-end ${visible.done ? "shown" : ""}`}>
                {visible.done && result?.status === "finished" ? (
                  <Check size={18} />
                ) : visible.done ? (
                  <span>!</span>
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="console-bottom">
        <span>
          <span className={`status-dot ${active ? "online" : ""}`} />
          {measuring
            ? "Six isolated Chromium contexts"
            : race
              ? `Recorded ${stamp(race.createdAt)} · engine ${race.engineVersion}`
              : "Live Chromium fixture, no generated verdicts"}
        </span>
        <span>
          {active
            ? "Counts are measured. Time is estimated."
            : "Press start. Listen to the difference."}
        </span>
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {reduced.current && race && (
        <div className="reduced-controls">
          <p>
            Reduced motion is on. Show results or step through the recorded
            evidence.
          </p>
          <button className="secondary" onClick={() => setMode("done")}>
            Show results
          </button>
          <button className="secondary" onClick={() => setDetail("mouse")}>
            Step through
          </button>
        </div>
      )}
      {race?.error && (
        <p className="error" role="alert">
          {race.error}
        </p>
      )}
      {done && race && (
        <div className="results-area">
          <div className="result-banner">
            <div>
              <span className="result-kicker">The photo finish</span>
              <h2>
                {race.status === "invalid_journey" ? (
                  "Journey invalid"
                ) : (
                  <>
                    <b>{finished}</b> of {race.results.length} finished.
                  </>
                )}
              </h2>
              <p>
                {race.status === "invalid_journey"
                  ? "Choose a journey the mouse can complete."
                  : finished === race.results.length
                    ? "Every measured input method reached the same finish line."
                    : "Same website. Different barriers. Select a lane to see why."}
              </p>
            </div>
            <button className="share-button" onClick={share}>
              {copied ? <CheckCheck size={16} /> : <LinkIcon size={16} />}{" "}
              {copied ? "Link copied" : "Copy race link"}
            </button>
          </div>
          <div className="photo-strip" aria-hidden="true">
            {[...race.results]
              .sort(
                (a, b) =>
                  Number(b.status === "finished") -
                    Number(a.status === "finished") ||
                  a.estSeconds - b.estSeconds,
              )
              .map((r) => {
                const frame = r.events.findLast((e) => e.frameId);
                return (
                  <div key={r.lane}>
                    {frame && (
                      <img src={`/api/frames/${frame.frameId}`} alt="" />
                    )}
                    <span>
                      {laneMeta[r.lane].name}
                      <b>
                        {r.status === "finished"
                          ? `${r.estSeconds.toFixed(1)}s`
                          : r.status === "dnf"
                            ? "DNF"
                            : "Unknown"}
                      </b>
                    </span>
                  </div>
                );
              })}
          </div>
          <details className="result-details">
            <summary>Read the results as a table</summary>
            <div className="table-scroll">
              <table>
                <caption>Measured costs and estimated completion times</caption>
                <thead>
                  <tr>
                    <th>Input method</th>
                    <th>Result</th>
                    <th>Measured cost</th>
                    <th>Estimated time</th>
                  </tr>
                </thead>
                <tbody>
                  {race.results.map((r) => (
                    <tr key={r.lane}>
                      <th scope="row">{laneMeta[r.lane].name}</th>
                      <td>
                        {r.status === "finished"
                          ? "Finished"
                          : r.status === "dnf"
                            ? "Did not finish"
                            : "Unknown"}
                      </td>
                      <td>
                        {fmt(r.cost.value)} {r.cost.unit}
                      </td>
                      <td>
                        {r.estSeconds.toFixed(1)} seconds
                        {r.status !== "finished" ? " to stop" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      {detail && (
        <Evidence
          race={race}
          lane={detail}
          onClose={() => setDetail(undefined)}
        />
      )}
    </section>
  );
}
function Evidence({
  race,
  lane,
  onClose,
}: {
  race?: Race;
  lane: Lane;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const result = race?.results.find((r) => r.lane === lane);
  const [eventIndex, setEventIndex] = useState(
    Math.max(0, (result?.events.length ?? 1) - 1),
  );
  const [copied, setCopied] = useState(false);
  const event = result?.events[eventIndex];
  const Icon = icons[lane];
  useEffect(() => {
    dialog.current?.showModal();
    const node = dialog.current;
    return () => node?.close();
  }, []);
  return (
    <dialog
      className="evidence-dialog"
      aria-labelledby="evidence-title"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        dialog.current?.close();
        onClose();
      }}
    >
      <div className="drawer-header">
        <div>
          <Icon size={22} />
          <h2 id="evidence-title">{laneMeta[lane].name}</h2>
        </div>
        <button
          className="icon-button"
          onClick={() => {
            dialog.current?.close();
            onClose();
          }}
          aria-label="Close evidence"
        >
          <X />
        </button>
      </div>
      <div className="drawer-body">
        {!result ? (
          <>
            <h3>Evidence appears after a run.</h3>
            <p>
              Start the race to measure this input method in a real browser.
            </p>
          </>
        ) : (
          <>
            <div className={`evidence-status ${result.status}`}>
              <strong>
                {result.status === "finished"
                  ? "Journey completed"
                  : result.status === "dnf"
                    ? "Did not finish"
                    : "Measurement unknown"}
              </strong>
              <span>
                {fmt(result.cost.value)} {result.cost.unit}
              </span>
            </div>
            <p>{result.events.at(-1)?.text}</p>
            {event?.frameId && (
              <figure className="frame">
                <div>
                  <img
                    src={`/api/frames/${event.frameId}`}
                    alt={`Captured browser viewport at event ${event.i + 1}: ${event.text}`}
                  />
                  {event.box && (
                    <span
                      className="focus-box"
                      style={{
                        left: `${(event.box.x / (lane === "zoom" ? 320 : lane === "budget" ? 412 : 1280)) * 100}%`,
                        top: `${(event.box.y / (lane === "zoom" ? 512 : lane === "budget" ? 823 : 800)) * 100}%`,
                        width: `${(event.box.w / (lane === "zoom" ? 320 : lane === "budget" ? 412 : 1280)) * 100}%`,
                        height: `${(event.box.h / (lane === "zoom" ? 512 : lane === "budget" ? 823 : 800)) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <figcaption>
                  Event {event.i + 1} / {result.events.length} · {event.text}
                </figcaption>
              </figure>
            )}
            <h3>The event trail</h3>
            <ol className="event-trail">
              {result.events.map((e, i) => (
                <li key={e.i}>
                  <button
                    aria-current={eventIndex === i ? "step" : undefined}
                    onClick={() => setEventIndex(i)}
                  >
                    <span>{i + 1}</span>
                    <div>
                      <strong>
                        {e.kind === "announce"
                          ? "Announcement"
                          : e.kind === "command"
                            ? "Spoken command"
                            : e.kind}
                      </strong>
                      <p>{e.text}</p>
                    </div>
                    <small>+{fmt(e.costDelta)}</small>
                  </button>
                </li>
              ))}
            </ol>
            {result.reasonCode && (
              <div className="fix-block">
                <h3>
                  {result.status === "unknown"
                    ? "Measurement limit"
                    : "What to fix"}
                </h3>
                <p>{reasons[result.reasonCode].hint}</p>
                <p className="subtle">
                  {result.wcag.length
                    ? `Related WCAG ${result.wcag.join(", ")}`
                    : "No WCAG failure claimed."}
                </p>
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        fixPrompt(race!, result),
                      );
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}{" "}
                  {copied ? "Fix prompt copied" : "Copy fix prompt"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
type Scan = {
  screenshot: string;
  width: number;
  height: number;
  elements: {
    number: number;
    label: string;
    target: JourneyStep["target"];
    box?: { x: number; y: number; w: number; h: number };
  }[];
};
function JourneyPicker({ onCreated }: { onCreated: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<Scan>();
  const [selected, setSelected] = useState<number[]>([]);
  const [prefix, setPrefix] = useState<JourneyStep[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const instruction = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (scan) instruction.current?.focus();
  }, [scan]);
  const currentSteps = scan
    ? selected.map((n) => {
        const element = scan.elements.find((e) => e.number === n)!;
        return { label: element.label, target: element.target };
      })
    : [];
  const journey = [...prefix, ...currentSteps];
  async function detect(prior: JourneyStep[] = []) {
    setBusy(prior.length ? "Previewing actions" : "Scanning");
    setError("");
    try {
      const next = await api<Scan>("/api/journey/scan", {
        method: "POST",
        body: JSON.stringify({ url, journey: prior, authorized: consent }),
      });
      setScan(next);
      setPrefix(prior);
      setSelected([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function toggle(n: number) {
    setSelected((previous) =>
      previous.includes(n)
        ? previous.filter((x) => x !== n)
        : previous.length + prefix.length < 3
          ? [...previous, n]
          : previous,
    );
  }
  async function run() {
    setBusy("Starting");
    setError("");
    try {
      const { id } = await api<{ id: string }>("/api/races", {
        method: "POST",
        body: JSON.stringify({ url, journey: scan ? journey : undefined }),
      });
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  return (
    <section className="site-picker" id="race-your-site">
      <div className="section-heading">
        <div>
          <span className="section-number">02</span>
          <h2>Your site. Your finish line.</h2>
        </div>
      </div>
      <p>
        Paste a public URL. Choose up to three actions.
        <br />
        Find out who makes it through.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void detect();
        }}
      >
        <label htmlFor="site-url">Website URL</label>
        <div className="url-input">
          <LinkIcon size={17} />
          <input
            id="site-url"
            type="url"
            required
            disabled={!!busy}
            placeholder="https://your-site.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setScan(undefined);
              setSelected([]);
              setPrefix([]);
            }}
          />
          <button
            type="submit"
            disabled={!!busy}
            aria-label="Scan this website"
          >
            <Search size={18} />
          </button>
        </div>
        {busy && <p role="status">{busy}… This can take a few seconds.</p>}
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {scan && (
        <>
          <p className="picker-instruction" tabIndex={-1} ref={instruction}>
            Choose actions in order ({journey.length}/3). Preview your selection
            to reveal controls on the next page or inside a drawer.
          </p>
          {!!journey.length && (
            <ol aria-label="Selected journey steps">
              {journey.map((step, index) => (
                <li key={index}>{step.label}</li>
              ))}
            </ol>
          )}
          {!!prefix.length && (
            <p>
              The preview has completed {prefix.length} selected{" "}
              {prefix.length === 1 ? "action" : "actions"}. Choose what happens
              next.
            </p>
          )}
          <div className="scan-preview">
            <img
              src={scan.screenshot}
              alt="Website viewport. Numbered controls are also listed below."
            />
            {scan.elements
              .filter((e) => e.box && e.box.y < 800)
              .map((e) => (
                <button
                  className={`scan-marker ${selected.includes(e.number) ? "selected" : ""}`}
                  key={e.number}
                  style={{
                    left: `${Math.min(96, Math.max(0, (e.box!.x / 1280) * 100))}%`,
                    top: `${Math.min(94, Math.max(0, (e.box!.y / 800) * 100))}%`,
                  }}
                  onClick={() => toggle(e.number)}
                  disabled={
                    !!busy ||
                    (journey.length === 3 && !selected.includes(e.number))
                  }
                  aria-label={`${selected.includes(e.number) ? prefix.length + selected.indexOf(e.number) + 1 : e.number}. Select ${e.label}`}
                  aria-pressed={selected.includes(e.number)}
                >
                  {selected.includes(e.number)
                    ? prefix.length + selected.indexOf(e.number) + 1
                    : e.number}
                </button>
              ))}
          </div>
          <div
            className="picker-options"
            role="group"
            aria-label="Journey controls in page order"
          >
            {scan.elements.map((e) => (
              <label key={e.number}>
                <input
                  type="checkbox"
                  checked={selected.includes(e.number)}
                  disabled={
                    !!busy ||
                    (journey.length === 3 && !selected.includes(e.number))
                  }
                  onChange={() => toggle(e.number)}
                />
                <span>
                  {e.number}. {e.label}
                </span>
                {selected.includes(e.number) && (
                  <b>Step {prefix.length + selected.indexOf(e.number) + 1}</b>
                )}
              </label>
            ))}
          </div>
          {scan.elements.length === 0 && (
            <p>
              No visible controls were found in this preview. You can race the
              selected steps or reset the journey.
            </p>
          )}
          <div className="picker-actions">
            <button
              className="secondary"
              disabled={
                !!busy || !consent || !selected.length || journey.length >= 3
              }
              onClick={() => void detect(journey)}
            >
              Preview selected actions
            </button>
            {!!prefix.length && (
              <button
                className="secondary"
                disabled={!!busy || (!consent && prefix.length > 1)}
                onClick={() => void detect(prefix.slice(0, -1))}
              >
                Edit previous step
              </button>
            )}
            {!!journey.length && (
              <button
                className="text-link"
                disabled={!!busy}
                onClick={() => void detect()}
              >
                Reset journey
              </button>
            )}
          </div>
          <p>
            Preview replays the selected actions in a fresh browser. Confirm
            authorization below before using it.
          </p>
        </>
      )}
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          I’m authorized to run this journey. Actions can change carts, submit
          forms or place orders.
        </span>
      </label>
      <button
        className="primary race-url-button"
        disabled={!url || !consent || !!busy || (!!scan && !journey.length)}
        onClick={() => void run()}
      >
        <Flag size={16} />
        {busy === "Starting" ? "Starting race…" : "Start race"}
      </button>
      <span className="picker-footnote">
        <Activity size={13} /> Public URLs only. No login required.
      </span>
    </section>
  );
}
type Matrix = {
  checkedAt: string | null;
  total?: number;
  passed?: number;
  rows: {
    fixture: string;
    cells: {
      lane: Lane;
      pass: boolean;
      actual: { status: string; reasonCode: string | null };
    }[];
  }[];
};
function Method() {
  const [matrix, setMatrix] = useState<Matrix>();
  useEffect(() => {
    api<Matrix>("/api/matrix")
      .then(setMatrix)
      .catch(() => {});
  }, []);
  return (
    <article className="method-page">
      <div className="page-intro">
        <span className="intro-line">
          <Info size={16} /> Method & limits
        </span>
        <h1>A race you can inspect.</h1>
        <p>
          Finish Line measures the effort of one journey through real Chromium
          browsers. It does not simulate a disability or certify a website.
        </p>
      </div>
      <section className="method-section">
        <h2>What each lane actually does</h2>
        <div className="method-grid">
          {lanes.map((lane, i) => {
            const Icon = icons[lane];
            const description = {
              mouse:
                "Clicks each selected control, then checks for an observable effect. A mouse failure invalidates the whole journey.",
              keyboard:
                "Presses Tab, Enter and Space. Counts every key. Detects unreachable controls, focus cycles, covered targets and activations with no effect.",
              screenreader:
                "Traverses with Tab and reads computed names, roles and states from Chromium’s accessibility tree. This is virtual Tab-mode navigation, not VoiceOver or NVDA.",
              voice:
                "Resolves “click [visible label]” against computed accessible names. Duplicate names add “show numbers” and a number selection. This models label resolution, not a speech recognizer.",
              zoom: "Tests reflow at a 320 × 512 CSS pixel viewport, equivalent to 1280 pixels at 400% zoom. Counts vertical screens and checks horizontal access and covered targets.",
              budget:
                "Measures time until the target is usable in Chromium at 412 × 823 CSS pixels with 4× CPU throttling, 150 ms network latency, 1.6 Mbps down and 750 kbps up.",
            }[lane];
            return (
              <div className="method-item" key={lane}>
                <span className="method-index">{i + 1}</span>
                <h3>
                  <Icon size={20} />
                  {laneMeta[lane].name}
                </h3>
                <p>{description}</p>
                <span className="measure-unit">
                  Measured in {laneMeta[lane].unit}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="method-section">
        <h2>The clock is an estimate.</h2>
        <p>
          The counts are browser observations. Human time is a simplified model
          informed by{" "}
          <a
            href="https://iihm.imag.fr/blanch/ens/2010-2011/M1/EIHM/cours/1980-Card-KLM.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Card, Moran and Newell’s 1980 Keystroke-Level Model
          </a>
          . P = 1.1 s, K = 0.28 s (average non-secretarial typist) and M = 1.35
          s come from the paper. Its pointing operator excludes a 0.2 s button
          press. Speech, scrolling and voice constants below are project
          assumptions, not validated KLM extensions.
        </p>
        <div className="table-scroll">
          <table>
            <caption>Constants and formulas used in this build</caption>
            <thead>
              <tr>
                <th>Lane</th>
                <th>Estimated seconds</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Mouse</th>
                <td>1.1 point + 0.2 click per step</td>
              </tr>
              <tr>
                <th scope="row">Keyboard</th>
                <td>
                  {KLM.key} × key presses + {KLM.mental} per step
                </td>
              </tr>
              <tr>
                <th scope="row">Screen reader</th>
                <td>
                  Words ÷ 5 (300 words/minute) + 0.2 per announcement + 1.35 per
                  step
                </td>
              </tr>
              <tr>
                <th scope="row">Voice control</th>
                <td>
                  2.0 speaking + 0.5 recognition per command + 1.35 per step
                </td>
              </tr>
              <tr>
                <th scope="row">400% zoom</th>
                <td>0.8 per screen scrolled + mouse step cost</td>
              </tr>
              <tr>
                <th scope="row">Budget phone</th>
                <td>Measured usable time + mouse step cost</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Experienced screen-reader users often listen faster and use headings,
          landmarks and browse mode. Tab mode is one route through a page.
          Simplified mental-operator placement is not a full KLM task analysis.
          Times from different lanes should not be read as measurements of
          people.
        </p>
        <p>
          Mobile conditions are inspired by{" "}
          <a href="https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md">
            Lighthouse’s mobile profile
          </a>
          . These are directly applied browser throttles; they do not reproduce
          Lighthouse’s simulated performance score or a physical phone.
        </p>
      </section>
      <section className="method-section">
        <div className="section-heading">
          <h2>The correctness matrix</h2>
          <span className="matrix-count">
            {matrix?.total
              ? `${matrix.passed} / ${matrix.total} checks passed`
              : "Not yet measured"}
          </span>
        </div>
        <p>
          Each fixture isolates a known behavior. A pass means the engine’s
          observed result matched the fixture’s declared expectation. It does
          not mean that fixture is accessible.
        </p>
        <div className="table-scroll">
          <table className="matrix">
            <caption>
              {matrix?.checkedAt
                ? `Actual local Chromium run, ${stamp(matrix.checkedAt)}`
                : "Awaiting a local fixture run"}
            </caption>
            <thead>
              <tr>
                <th>Controlled fixture</th>
                {lanes.map((l) => (
                  <th key={l}>{laneMeta[l].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix?.rows.map((row) => (
                <tr key={row.fixture}>
                  <th scope="row">
                    <a href={`/fixtures/${row.fixture}.html`}>
                      {row.fixture.replaceAll("-", " ")}
                    </a>
                  </th>
                  {row.cells.map((c) => (
                    <td key={c.lane}>
                      <span className={c.pass ? "matrix-pass" : "matrix-fail"}>
                        {c.pass ? <Check size={13} /> : <X size={13} />}{" "}
                        {c.pass ? "Pass" : "Fail"}
                      </span>
                      <small>
                        {c.actual.status === "dnf" ? "DNF" : c.actual.status}
                        {c.actual.reasonCode && ` / ${c.actual.reasonCode}`}
                      </small>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="method-section two-columns">
        <div>
          <h2>Grounded in access needs.</h2>
          <p>
            The{" "}
            <a href="https://alphagov.github.io/accessibility-personas/">
              UK Government Digital Service accessibility personas
            </a>{" "}
            informed the lane choices: Ashleigh (screen reader), Chris
            (keyboard) and Claudia (magnification).
          </p>
          <blockquote>
            “A simulation is never a true representation of an impairment.”
          </blockquote>
          <p>
            Their caveat also applies here. Automated evidence complements
            testing with people who have access needs.
          </p>
        </div>
        <div>
          <h2>Manual agreement</h2>
          <p>
            Manual keyboard and VoiceOver/NVDA agreement checks have not been
            completed. No agreement percentage or real-user participation is
            claimed.
          </p>
          <p>
            The permanent Finish Line self-race is listed with the controlled
            benchmark recordings once measured. Automated accessibility checks
            are documented separately from human testing.
          </p>
        </div>
      </section>
      <section className="method-section">
        <h2>Where the method stops</h2>
        <ul className="limits-list">
          <li>
            One to three activation steps. No credentials, text-entry journeys,
            CAPTCHA solving or cross-origin iframe/shadow-root discovery.
          </li>
          <li>
            Accessible-name matching models one voice-control route. Actual
            speech recognizers and assistive technologies may behave
            differently.
          </li>
          <li>
            Unspecified activation effects use URL, DOM content, dialogs and
            expansion changes. Unrelated page updates can cause false positives.
            Explicit journey expectations are stronger.
          </li>
          <li>
            Hidden mobile menus produce unknown, not a failure. Reflow is a
            viewport check, not a full browser-zoom audit.
          </li>
          <li>
            Engine failures and timeouts produce unknown. They are never counted
            as accessibility DNFs.
          </li>
          <li>
            HTTP(S) traffic uses a DNS-validated proxy that pins each upstream
            connection to the checked public address. Redirects and subresources
            are checked again. Production network-level private-range denial
            remains recommended for defense in depth.
          </li>
          <li>
            The Deployxa account is connected read-only. Zero-spend mode blocks
            cloud changes, rollback and AI requests. Hosting and builder
            benchmarks still need verified free hosting and original source
            exports.
          </li>
        </ul>
      </section>
    </article>
  );
}
function Deploys() {
  const [data, setData] = useState<{
    connected: boolean;
    reason: string;
    capabilities: string[];
    projects: Record<string, unknown>[];
  }>();
  const [selected, setSelected] = useState("");
  const [deployments, setDeployments] = useState<{
    deployments: Record<string, unknown>[];
    races: Race[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<NonNullable<typeof data>>("/api/deployxa/projects")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  async function select(id: string) {
    setSelected(id);
    setError("");
    try {
      setDeployments(
        await api(
          `/api/deployxa/projects/${encodeURIComponent(id)}/deployments`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <article className="deploy-page">
      <div className="page-intro">
        <span className="intro-line">
          <Activity size={16} /> Deploy history
        </span>
        <h1>
          A deploy is ready.
          <br />
          Is everyone else?
        </h1>
        <p>
          Deployxa’s readiness score describes whether an app will run. Finish
          Line checks who can use one journey.
        </p>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data?.connected ? (
        <div className="connection-state">
          <div className="connection-icon">
            <LinkIcon size={32} />
          </div>
          <h2>
            {data
              ? "Connect Deployxa to race your deploys."
              : "Checking the Deployxa connection…"}
          </h2>
          <p>{data?.reason ?? "Looking for a server-side connection."}</p>
          <p>
            Configure a read-only Deployxa API key on the server. Available
            features are discovered from the tools your account actually
            exposes.
          </p>
          <a
            className="primary"
            href="https://deployxa.com/dashboard/api-keys"
            target="_blank"
            rel="noreferrer"
          >
            Open Deployxa API keys <ExternalLink size={16} />
          </a>
          <a className="text-link" href="/">
            Explore the recorded races
          </a>
        </div>
      ) : (
        <>
          <p role="status">
            Connected to Deployxa. Zero-spend mode is on: cloud changes,
            rollback and AI requests are disabled. You can inspect deployments
            and run accessibility checks locally.
          </p>
          {data.projects.length === 0 && (
            <p>
              No projects were returned by your account. Recorded races remain
              available on Home.
            </p>
          )}
          <label htmlFor="project">Deployxa project</label>
          <select
            id="project"
            value={selected}
            onChange={(e) => void select(e.target.value)}
          >
            <option value="">Select a project</option>
            {data.projects.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name ?? p.id)}
              </option>
            ))}
          </select>
          <div className="table-scroll">
            <table>
              <caption>Deployment history reported by Deployxa</caption>
              <thead>
                <tr>
                  <th>Deployment</th>
                  <th>Status</th>
                  <th>Finish Line race</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deployments?.deployments.map((d) => (
                  <tr key={String(d.id)}>
                    <th>{String(d.id)}</th>
                    <td>{String(d.status ?? "Unknown")}</td>
                    <td>
                      {deployments.races
                        .filter((r) => r.deployxaDeploymentId === d.id)
                        .map((r) => (
                          <a key={r.id} href={`/race/${r.id}`}>
                            {
                              r.results.filter((l) => l.status === "finished")
                                .length
                            }{" "}
                            / {r.results.length} finished
                          </a>
                        ))}
                    </td>
                    <td>
                      {data.capabilities.some((name) =>
                        [
                          "deployxa_get_deployment_status",
                          "deployxa_get_deployment",
                        ].includes(name),
                      ) && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            setError("");
                            try {
                              const race = await api<{ id: string }>(
                                `/api/deployxa/deployments/${encodeURIComponent(String(d.id))}/race`,
                                {
                                  method: "POST",
                                  body: JSON.stringify({ projectId: selected }),
                                },
                              );
                              location.href = `/race/${race.id}`;
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Race this deploy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Connection details</summary>
            <p>
              {data.capabilities.length} tools discovered. Only read-only tools
              are enabled for this page.
            </p>
          </details>
        </>
      )}
      <div className="deploy-principles">
        <div>
          <Flag size={22} />
          <h3>A journey gate</h3>
          <p>
            A lane changing from Finish to DNF flags a regression against the
            previous completed deployment race.
          </p>
        </div>
        <div>
          <RotateCcw size={22} />
          <h3>No cash spending</h3>
          <p>
            This app cannot buy services, upgrade your plan, deploy resources or
            roll back a deployment. Your account’s billing settings remain under
            your control.
          </p>
        </div>
        <div>
          <AudioLines size={22} />
          <h3>Evidence on every result</h3>
          <p>
            Frames, announcements and commands connect a deployment change to
            the barrier it introduced.
          </p>
        </div>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
