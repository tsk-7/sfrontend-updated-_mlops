"use client";

import { Activity, AlertCircle, Check, CircleHelp, MoonStar, ScanLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Profile = {
  age: string;
  gender: "Female" | "Male" | "Other";
  occupation: string;
  daily_screen_time_hours: string;
  phone_usage_before_sleep_minutes: string;
  sleep_duration_hours: string;
  stress_level: string;
  caffeine_intake_cups: string;
  physical_activity_minutes: string;
  notifications_received_per_day: string;
  mental_fatigue_score: string;
};
type Payload = { [K in keyof Profile]: K extends "gender" | "occupation" ? Profile[K] : number };
type NumericKey = Exclude<keyof Profile, "gender" | "occupation">;
type Errors = Partial<Record<keyof Profile, string>>;
type Health = { status?: unknown; [key: string]: unknown };
type Metadata = { raw_rows?: unknown; train_rows?: unknown; test_rows?: unknown; target?: unknown; engineered_schema?: unknown };
type Prediction = { score: number; interpretation: string; modelPath: string | null };
type NumericField = { key: NumericKey; label: string; unit: string; min: number; max: number; integer?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getApiErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const message = [body.error, body.message, body.detail].find((item) => typeof item === "string");
  if (typeof message === "string") return message;
  if (!Array.isArray(body.detail)) return null;

  const details = body.detail.flatMap((item) => {
    if (!isRecord(item) || typeof item.msg !== "string") return [];
    const location = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
    return [`${location ? `${location}: ` : ""}${item.msg}`];
  });
  return details.length ? details.join(" ") : null;
}

const initial: Profile = {
  age: "30", gender: "Female", occupation: "Teacher", daily_screen_time_hours: "4.5",
  phone_usage_before_sleep_minutes: "45", sleep_duration_hours: "7.2", stress_level: "4.0",
  caffeine_intake_cups: "2", physical_activity_minutes: "45", notifications_received_per_day: "120",
  mental_fatigue_score: "4.0",
};

const numericFields: NumericField[] = [
  { key: "age", label: "Age", unit: "years", min: 13, max: 100, integer: true },
  { key: "sleep_duration_hours", label: "Sleep duration", unit: "hours", min: 0, max: 24 },
  { key: "phone_usage_before_sleep_minutes", label: "Phone before sleep", unit: "minutes", min: 0, max: 720 },
  { key: "daily_screen_time_hours", label: "Screen time", unit: "hours / day", min: 0, max: 24 },
  { key: "stress_level", label: "Stress level", unit: "1–10", min: 1, max: 10 },
  { key: "mental_fatigue_score", label: "Mental fatigue", unit: "1–10", min: 1, max: 10 },
  { key: "caffeine_intake_cups", label: "Caffeine", unit: "cups / day", min: 0, max: 30 },
  { key: "physical_activity_minutes", label: "Physical activity", unit: "minutes / day", min: 0, max: 1440 },
  { key: "notifications_received_per_day", label: "Notifications", unit: "per day", min: 0, max: 5000 },
];

const sections: { title: string; keys: (NumericKey | "gender" | "occupation")[] }[] = [
  { title: "About you", keys: ["age", "gender", "occupation"] },
  { title: "Sleep window", keys: ["sleep_duration_hours", "phone_usage_before_sleep_minutes"] },
  { title: "Daily rhythm", keys: ["daily_screen_time_hours", "stress_level", "mental_fatigue_score", "caffeine_intake_cups", "physical_activity_minutes", "notifications_received_per_day"] },
];

function validate(profile: Profile): Errors {
  const errors: Errors = {};
  for (const field of numericFields) {
    const raw = profile[field.key].trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value)) errors[field.key] = "Enter a number.";
    else if (field.integer && !Number.isInteger(value)) errors[field.key] = "Enter a whole number.";
    else if (value < field.min || value > field.max) errors[field.key] = `Enter a value from ${field.min} to ${field.max}.`;
  }
  if (profile.occupation.trim().length < 2) errors.occupation = "Enter at least 2 characters.";
  return errors;
}

function toPayload(profile: Profile): Payload {
  return {
    age: Number(profile.age), gender: profile.gender, occupation: profile.occupation.trim(),
    daily_screen_time_hours: Number(profile.daily_screen_time_hours),
    phone_usage_before_sleep_minutes: Number(profile.phone_usage_before_sleep_minutes),
    sleep_duration_hours: Number(profile.sleep_duration_hours), stress_level: Number(profile.stress_level),
    caffeine_intake_cups: Number(profile.caffeine_intake_cups),
    physical_activity_minutes: Number(profile.physical_activity_minutes),
    notifications_received_per_day: Number(profile.notifications_received_per_day),
    mental_fatigue_score: Number(profile.mental_fatigue_score),
  };
}

function format(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function SleepAnalysis({ embedded = false }: { embedded?: boolean }) {
  const [profile, setProfile] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [requestError, setRequestError] = useState("");
  const [pending, setPending] = useState(false);
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [health, setHealth] = useState<Health | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<"loading" | "available" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    const refreshHealth = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!active) return;
        if (!response.ok) throw new Error("Health check failed.");
        const result: unknown = await response.json();
        if (!active) return;
        if (!isRecord(result)) throw new Error("Health check returned invalid data.");
        const data = result as Health;
        setHealth(data);
        const okay = ["ok", "healthy", "ready", "available"].includes(String(data.status ?? "").toLowerCase());
        setConnection(okay && data.model_available === true ? "online" : "offline");
      } catch {
        if (active) {
          setHealth(null);
          setConnection("offline");
        }
      }
    };
    const refreshMetadata = async () => {
      try {
        const response = await fetch("/api/metadata", { cache: "no-store" });
        if (!response.ok) throw new Error("Metadata request failed.");
        const result: unknown = await response.json();
        if (!active) return;
        if (!isRecord(result)) throw new Error("Metadata response was invalid.");
        setMetadata(result as Metadata);
        setMetadataStatus("available");
      } catch {
        if (active) {
          setMetadata(null);
          setMetadataStatus("unavailable");
        }
      }
    };
    const refresh = () => {
      void refreshHealth();
      void refreshMetadata();
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const changeNumber = (key: NumericKey, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setRequestError("");
    setPrediction(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(profile);
    setErrors(nextErrors);
    setRequestError("");
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setPrediction(null);
    setPending(true);
    try {
      const response = await fetch("/api/predict", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPayload(profile)),
      });
      const responseText = await response.text();
      let body: unknown = null;
      try {
        body = responseText ? JSON.parse(responseText) as unknown : null;
      } catch {
        body = null;
      }
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body) ?? "The analysis could not be completed.");
      }
      if (!isRecord(body)) throw new Error("The service returned an invalid prediction response.");
      const score = body.predicted_sleep_quality_score;
      if (typeof score !== "number" || !Number.isFinite(score) || score < 1 || score > 10) {
        throw new Error("The service did not return a valid sleep quality estimate.");
      }
      if (typeof body.interpretation !== "string" || !body.interpretation.trim()) {
        throw new Error("The service did not return an interpretation for this estimate.");
      }
      setPrediction({
        score,
        interpretation: body.interpretation,
        modelPath: typeof body.model_path === "string" ? body.model_path : null,
      });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The analysis could not be completed.");
    } finally {
      setPending(false);
    }
  };

  const statusLabel = connection === "checking" ? "Connecting to model" : connection === "online" ? "Service available" : "Service unavailable";
  const availability = health ? Object.entries(health).filter(([key, value]) => /available/i.test(key) && typeof value === "boolean") : [];
  const position = prediction ? `${Math.max(0, Math.min(100, ((prediction.score - 1) / 9) * 100))}%` : "0%";
  const schema = metadata?.engineered_schema;
  const schemaText = schema === undefined ? "" : typeof schema === "string" ? schema : JSON.stringify(schema, null, 2);

  return (
    <div className={`page-shell ${embedded ? "embedded-analysis" : ""}`}>
      {!embedded && <header className="site-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><MoonStar size={18} /></span><span>Somna / Sleep lab</span></div>
        <div className="connection" role="status" aria-live="polite"><span className={`status-dot ${connection}`} aria-hidden="true" /><span>{statusLabel}</span>{connection === "checking" && <span className="loading-dots" aria-hidden="true"><span /><span /><span /></span>}</div>
      </header>}
      <div className="workspace">
        {!embedded && <section className="page-heading" aria-labelledby="page-title">
          <div><p className="eyebrow">Sleep pattern / analysis</p><h1 id="page-title" className="display-type">Sleep quality estimate</h1></div>
          <p className="heading-note">A snapshot based on your routine and the details you share below.</p>
        </section>}
        <div className="analysis-grid">
          <section className="form-column" aria-labelledby="profile-title">
            <div className="column-heading"><h2 id="profile-title">Your profile</h2><span className="step-label">11 inputs · all fields required</span></div>
            <form noValidate onSubmit={submit}>
              {sections.map((section, index) => <section className="form-section" aria-labelledby={`section-${index}`} key={section.title}>
                <h3 id={`section-${index}`} className="section-title"><span className="section-number">0{index + 1}</span>{section.title}</h3>
                <div className={`field-grid ${section.keys.length > 2 ? "three-up" : ""}`}>
                  {section.keys.map((key) => {
                    if (key === "gender") return <div className="field" key={key}><div className="field-label-row"><label htmlFor="gender">Gender</label></div><select id="gender" className="control" required value={profile.gender} onChange={(event) => { const gender = event.currentTarget.value as Profile["gender"]; setProfile((current) => ({ ...current, gender })); setRequestError(""); setPrediction(null); }}><option>Female</option><option>Male</option><option>Other</option></select></div>;
                    if (key === "occupation") return <div className="field" key={key}><div className="field-label-row"><label htmlFor="occupation">Occupation</label></div><input id="occupation" className="control" type="text" required minLength={2} value={profile.occupation} aria-invalid={Boolean(errors.occupation)} aria-describedby={errors.occupation ? "occupation-error" : undefined} onChange={(event) => { const occupation = event.currentTarget.value; setProfile((current) => ({ ...current, occupation })); setErrors((current) => ({ ...current, occupation: undefined })); setRequestError(""); setPrediction(null); }} />{errors.occupation && <p id="occupation-error" className="field-error">{errors.occupation}</p>}</div>;
                    const field = numericFields.find((item) => item.key === key)!;
                    const errorId = `${key}-error`;
                    return <div className="field" key={key}><div className="field-label-row"><label htmlFor={key}>{field.label}</label><span className="field-unit">{field.unit}</span></div><input id={key} className="control" type="number" required inputMode="decimal" min={field.min} max={field.max} step={field.integer ? 1 : "any"} value={profile[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? errorId : undefined} onChange={(event) => changeNumber(key, event.currentTarget.value)} />{errors[key] && <p id={errorId} className="field-error">{errors[key]}</p>}</div>;
                  })}
                </div>
              </section>)}
              <div className="submit-row"><button type="submit" className="analyze-button" disabled={pending}>{pending ? <Activity size={16} aria-hidden="true" /> : <ScanLine size={16} aria-hidden="true" />}<span>{pending ? "Waiting for the model…" : "Analyze sleep"}</span></button><p className="form-note">Render’s free service may take a little while to wake after inactivity.</p></div>
              {requestError && <p className="form-alert" role="alert"><AlertCircle size={15} aria-hidden="true" />{requestError}</p>}
            </form>
          </section>
          <aside className="result-column" aria-labelledby="result-title">
            <div className="result-heading"><h2 id="result-title">Analysis</h2><span className="estimate-tag">Estimate · not medical advice</span></div>
            <div className="score-block" aria-live="polite" aria-atomic="true"><p className="score-label">Predicted sleep quality</p><div className="score-value-row"><span className="score-value display-type">{prediction ? prediction.score.toFixed(1) : "—"}</span><span className="score-out-of">/ 10</span></div><div className="score-scale" role="img" aria-label={prediction ? `Estimated score ${prediction.score.toFixed(1)} on a scale from 1 to 10` : "Score scale from 1 to 10; analyze your profile to see an estimate"}><div className="scale-track">{prediction && <span className="scale-marker" style={{ left: position }} />}</div><div className="scale-ticks"><span>1 · lower</span><span>10 · higher</span></div></div></div>
            <p className={`interpretation ${prediction ? "" : "placeholder"}`} aria-live="polite">{prediction?.interpretation ?? (pending ? "Waiting for the prediction service. Render may need a moment to wake." : "Your returned interpretation will appear here after analysis.")}</p>
            <h3 className="summary-heading">Submitted profile</h3>
            <dl className="summary-list"><div className="summary-item"><dt>Age · gender</dt><dd>{profile.age} · {profile.gender}</dd></div><div className="summary-item"><dt>Occupation</dt><dd>{profile.occupation || "—"}</dd></div><div className="summary-item"><dt>Sleep duration</dt><dd>{profile.sleep_duration_hours} hours</dd></div><div className="summary-item"><dt>Screen time</dt><dd>{profile.daily_screen_time_hours} hours / day</dd></div><div className="summary-item"><dt>Stress · fatigue</dt><dd>{profile.stress_level} · {profile.mental_fatigue_score} / 10</dd></div><div className="summary-item"><dt>Phone before bed</dt><dd>{profile.phone_usage_before_sleep_minutes} minutes</dd></div><div className="summary-item"><dt>Caffeine</dt><dd>{profile.caffeine_intake_cups} cups / day</dd></div><div className="summary-item"><dt>Activity</dt><dd>{profile.physical_activity_minutes} minutes / day</dd></div><div className="summary-item"><dt>Notifications</dt><dd>{profile.notifications_received_per_day} / day</dd></div></dl>
            {prediction?.modelPath && <p className="model-path">Model: {prediction.modelPath}</p>}
            <section className="service-panel" aria-labelledby="service-title"><div className="service-title-row"><h3 id="service-title" className="service-title">Service & dataset</h3>{health?.status !== undefined && <span className="step-label">{format(health.status)}</span>}</div>
              {connection === "checking" && <p className="service-caption">Checking availability. The service may take a moment to wake.</p>}{connection === "offline" && <p className="service-caption">Could not confirm service availability. You can still try an analysis.</p>}
              {availability.length > 0 && <div className="availability-list" aria-label="Service availability">{availability.map(([key, value]) => <span className="availability-item" key={key}>{value ? <Check size={12} aria-hidden="true" /> : <CircleHelp size={12} aria-hidden="true" />}{key.replaceAll("_", " ")}: {value ? "yes" : "no"}</span>)}</div>}
              {metadata ? <><dl className="metadata-grid"><div className="metadata-cell"><dt>Raw rows</dt><dd>{format(metadata.raw_rows)}</dd></div><div className="metadata-cell"><dt>Train</dt><dd>{format(metadata.train_rows)}</dd></div><div className="metadata-cell"><dt>Test</dt><dd>{format(metadata.test_rows)}</dd></div></dl><p className="metadata-target">Target: {format(metadata.target)}</p>{schemaText && <details className="schema-details"><summary>Engineered schema</summary><pre className="schema-content">{schemaText}</pre></details>}</> : <p className="service-caption">{metadataStatus === "loading" ? "Loading dataset details…" : "Dataset metadata is unavailable right now."}</p>}
            </section>
            <p className="disclaimer"><Sparkles size={13} aria-hidden="true" />This score is an estimate from the connected model, not a diagnosis or medical advice.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}