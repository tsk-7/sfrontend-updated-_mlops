"use client";

import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Clock3,
  Compass,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  MoonStar,
  ScanLine,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { SleepAnalysis } from "@/components/sleep-analysis";
import { SleepPatternPages } from "@/components/sleep-pattern-pages";

export type SleepPageId =
  | "dashboard"
  | "calculator"
  | "timeline"
  | "trends"
  | "consistency"
  | "circadian"
  | "calendar"
  | "lifestyle"
  | "patterns"
  | "ml-analysis"
  | "reports";

const navigation = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { id: "calculator", label: "Sleep Calculator", href: "/sleep-calculator", icon: Clock3 },
  { id: "timeline", label: "Sleep Timeline", href: "/sleep-timeline", icon: Clock3 },
  { id: "trends", label: "Sleep Trends", href: "/sleep-trends", icon: ChartNoAxesCombined },
  { id: "consistency", label: "Sleep Consistency", href: "/sleep-consistency", icon: Target },
  { id: "circadian", label: "Circadian Analysis", href: "/circadian-analysis", icon: Compass },
  { id: "calendar", label: "Sleep Calendar", href: "/sleep-calendar", icon: CalendarDays },
  { id: "lifestyle", label: "Lifestyle Factors", href: "/lifestyle-factors", icon: HeartPulse },
  { id: "patterns", label: "Pattern Analysis", href: "/pattern-analysis", icon: Sparkles },
  { id: "ml-analysis", label: "ML Analysis", href: "/ml-analysis", icon: ScanLine },
  { id: "reports", label: "Reports", href: "/reports", icon: FileText },
] as const;

const pageCopy: Record<SleepPageId, { title: string; description: string; eyebrow: string }> = {
  dashboard: { title: "Sleep pattern overview", description: "Your timing, duration, and weekday-to-weekend rhythm at a glance.", eyebrow: "Overview" },
  calculator: { title: "Daily sleep calculator", description: "Log your bedtime and wake-up time to calculate each night and build your personal sleep timeline.", eyebrow: "Personal sleep log" },
  timeline: { title: "Sleep timeline", description: "See each sleep window across a 24-hour clock, including nights that cross midnight.", eyebrow: "Sleep rhythm" },
  trends: { title: "Sleep trends", description: "Explore how bedtime, wake time, and duration move across the selected period.", eyebrow: "Change over time" },
  consistency: { title: "Schedule consistency", description: "Compare timing variability across nights. These descriptive measures are not clinical scores.", eyebrow: "Regularity" },
  circadian: { title: "Circadian analysis", description: "Compare typical mid-sleep timing on weekdays and weekends.", eyebrow: "Weekday / weekend" },
  calendar: { title: "Sleep calendar", description: "Select a day to review its sleep window and associated routine details.", eyebrow: "Daily records" },
  lifestyle: { title: "Lifestyle factors", description: "Lifestyle tracking is separate from the sleep-timing record and is not collected in the sleep calculator.", eyebrow: "Optional context" },
  patterns: { title: "Pattern analysis", description: "Rule-based descriptions derived from the selected records, with the thresholds shown.", eyebrow: "Descriptive rules" },
  "ml-analysis": { title: "ML sleep quality analysis", description: "Run the connected prediction model with a profile of your routine.", eyebrow: "Model estimate" },
  reports: { title: "Sleep reports", description: "Review and export sleep timing and duration metrics from your saved records.", eyebrow: "Summary & export" },
};

function BackendStatus() {
  const [status, setStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [detail, setDetail] = useState("Checking the FastAPI service");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const body = (await response.json()) as Record<string, unknown>;
        if (!active) return;
        if (!response.ok) {
          setStatus("offline");
          setDetail(typeof body.error === "string" ? body.error : "Backend is currently unavailable.");
          return;
        }
        const flags = Object.entries(body).filter(([key, value]) => /available/i.test(key) && typeof value === "boolean");
        const unavailable = flags.filter(([, value]) => !value).map(([key]) => key.replaceAll("_", " "));
        const healthy = ["ok", "healthy", "ready", "available"].includes(String(body.status ?? "").toLowerCase());
        if (!healthy || unavailable.length || body.sleep_database_configured === false) {
          setStatus("offline");
          setDetail(body.sleep_database_configured === false
            ? "Sleep database is not configured."
            : unavailable.length ? `${unavailable.join(", ")} unavailable` : "Backend is currently unavailable.");
          return;
        }
        setStatus("connected");
        setDetail("Connected to FastAPI");
      } catch {
        if (!active) return;
        setStatus("offline");
        setDetail("Backend is currently unavailable. Please start the FastAPI service.");
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const label = status === "checking" ? "Checking" : status === "connected" ? "Connected" : "Offline";
  return (
    <div className="backend-status" role="status" aria-live="polite" title={detail}>
      <span className={`status-dot ${status === "connected" ? "online" : status === "offline" ? "offline" : "checking"}`} aria-hidden="true" />
      <span className="backend-label">Backend</span>
      <strong>{label}</strong>
      <span className="backend-detail">{detail}</span>
    </div>
  );
}

function NavigationLinks({ activePage, onNavigate }: { activePage: SleepPageId; onNavigate?: () => void }) {
  return (
    <nav className="primary-nav" aria-label="Sleep analysis pages">
      {navigation.map(({ id, label, href, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className={`nav-link ${activePage === id ? "active" : ""}`}
          aria-current={activePage === id ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SleepPatternApp({ activePage, children }: { activePage: SleepPageId; children?: ReactNode }) {
  const copy = pageCopy[activePage];
  const activeLabel = navigation.find((item) => item.id === activePage)?.label ?? "Dashboard";
  return (
    <div className="analytics-app">
      <aside className="desktop-sidebar">
        <Link className="product-brand" href="/">
          <span className="product-mark"><MoonStar size={19} aria-hidden="true" /></span>
          <span><strong>SleepInsight</strong><small>Sleep pattern analysis</small></span>
        </Link>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <NavigationLinks activePage={activePage} />
        <div className="sidebar-bottom"><BackendStatus /><div className="sidebar-footnote">Sleep pattern & cycle analysis</div></div>
      </aside>

      <div className="mobile-menu-bar">
        <Link className="product-brand" href="/"><span className="product-mark"><MoonStar size={19} aria-hidden="true" /></span><span><strong>SleepInsight</strong><small>Sleep pattern analysis</small></span></Link>
        <details className="mobile-nav-menu">
          <summary aria-label={`Open navigation menu, current page ${activeLabel}`}><Menu size={17} aria-hidden="true" /><span>Menu</span><ChevronDown size={15} aria-hidden="true" /></summary>
          <NavigationLinks activePage={activePage} />
        </details>
      </div>

      <main className="main-area">
        <div className="topbar">
          <div className="topbar-context"><span className="topbar-kicker">SLEEP PATTERN &amp; CYCLE ANALYSIS</span><span className="topbar-divider">/</span><span>{activeLabel}</span></div>
          <div className="topbar-backend"><BackendStatus /></div>
        </div>
        <div className="demo-notice" role="note">
          <span className="demo-pill">DATABASE</span>
          <span>Sleep-pattern analysis uses records saved through the backend. Sleep-quality ML predictions are separate.</span>
        </div>
        <section className="page-heading" aria-labelledby="page-title">
          <div><p className="eyebrow">{copy.eyebrow}</p><h1 id="page-title">{copy.title}</h1></div>
          <p className="page-description">{copy.description}</p>
        </section>
        {activePage === "dashboard" && (
          <section className="dashboard-hero" aria-label="Sleep pattern analytics introduction">
            <div className="dashboard-hero-copy">
              <span className="dashboard-hero-kicker"><MoonStar size={14} aria-hidden="true" /> SLEEP, IN BETTER FOCUS</span>
              <h2>Understand your rhythm.<br />Make rest more intentional.</h2>
              <p>Explore your sleep timing, daily patterns, and changes over time — all in one calm, clear view.</p>
            </div>
            <svg className="dashboard-landscape" viewBox="0 0 520 190" role="img" aria-label="Moonlit mountain landscape reflected on a lake">
              <defs>
                <linearGradient id="landscape-sky" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#7aa8f4" />
                  <stop offset="1" stopColor="#7461d7" />
                </linearGradient>
                <linearGradient id="landscape-water" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#6c8ddd" stopOpacity=".8" />
                  <stop offset="1" stopColor="#3d4d9b" stopOpacity=".12" />
                </linearGradient>
              </defs>
              <rect width="520" height="190" fill="url(#landscape-sky)" />
              <circle cx="386" cy="48" r="24" fill="#fff2cf" />
              <circle cx="396" cy="39" r="23" fill="#8b83e4" />
              <path d="M0 112 73 55l55 48 67-68 82 83 56-51 62 46 61-61 64 55v83H0Z" fill="#40538f" />
              <path d="m0 124 71-38 66 40 82-59 86 59 66-35 74 40 75-36v95H0Z" fill="#283c75" />
              <path d="M0 128h520v62H0Z" fill="url(#landscape-water)" />
              <path d="M245 137h92m-165 13h210m-249 14h280m-187 13h147" stroke="#dbe7ff" strokeOpacity=".38" strokeWidth="2" strokeLinecap="round" />
              <g fill="#fff" opacity=".72"><circle cx="92" cy="38" r="1.6" /><circle cx="155" cy="27" r="1.2" /><circle cx="286" cy="33" r="1.5" /><circle cx="464" cy="28" r="1.3" /><circle cx="227" cy="20" r="1" /></g>
            </svg>
          </section>
        )}
        <div className="page-content">
          {children ?? (activePage === "ml-analysis" ? <SleepAnalysis embedded /> : <SleepPatternPages page={activePage} />)}
        </div>
        <footer className="app-footer">Sleep records and timing metrics are loaded from the backend database. Sleep-quality ML prediction remains a separate feature.</footer>
      </main>
    </div>
  );
}