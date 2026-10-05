"use client";

import { Check, Clock3, MoonStar, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { clockToMinutes, formatClock, formatDuration, type SleepRecord } from "@/lib/sleep-data";
import { SLEEP_USER_ID, sleepHistoryService, type SleepRecordInput } from "@/lib/sleep-history-service";

type SleepFields = Omit<SleepRecordInput, "user_id" | "notes"> & { notes: string };
type FieldError = Partial<Record<keyof SleepFields, string>>;

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function validate(fields: SleepFields) {
  const errors: FieldError = {};
  if (!fields.sleep_date) errors.sleep_date = "Choose the date you woke up.";
  else if (fields.sleep_date > localToday()) errors.sleep_date = "Choose today or an earlier date.";
  for (const key of ["bedtime", "actual_sleep_time", "wake_up_time", "get_up_time"] as const) {
    if (!fields[key]) errors[key] = "Enter a time.";
  }
  return errors;
}

function ClockField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: keyof SleepFields;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="calculator-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="control"
        type="time"
        required
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}

export function SleepCalculator() {
  const today = localToday();
  const [fields, setFields] = useState<SleepFields>({
    sleep_date: today,
    bedtime: "",
    actual_sleep_time: "",
    wake_up_time: "",
    get_up_time: "",
    notes: "",
  });
  const [savedRecords, setSavedRecords] = useState<SleepRecord[]>([]);
  const [errors, setErrors] = useState<FieldError>({});
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [latestSaved, setLatestSaved] = useState<SleepRecord | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void sleepHistoryService.getHistory().then((history) => {
        if (!active) return;
        setSavedRecords(history.records);
        setLoadError("");
      }).catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Sleep records could not be loaded.");
      });
    };
    refresh();
    window.addEventListener("sleep-history-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("sleep-history-updated", refresh);
    };
  }, []);

  const change = (key: keyof SleepFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFeedback("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setFeedback("");
    setLatestSaved(null);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }

    setPending(true);
    try {
      const saved = await sleepHistoryService.saveRecord({
        ...fields,
        user_id: SLEEP_USER_ID,
        notes: fields.notes.trim() || null,
      });
      setLatestSaved(saved);
      setFeedback(`${readableDate(saved.date)} saved to your sleep database.`);
      setLoadError("");
      try {
        const history = await sleepHistoryService.getHistory();
        setSavedRecords(history.records);
      } catch (refreshError) {
        setLoadError(refreshError instanceof Error ? `Saved successfully, but the list could not refresh: ${refreshError.message}` : "Saved successfully, but the list could not refresh.");
      }
    } catch (error) {
      setFeedback("Unable to save sleep record. Please try again.");
      setLoadError(error instanceof Error ? error.message : "The sleep database did not confirm the save.");
    } finally {
      setPending(false);
    }
  };

  const removeRecord = async (record: SleepRecord) => {
    if (record.id === undefined) {
      setLoadError("This database record has no identifier and cannot be deleted.");
      return;
    }
    try {
      await sleepHistoryService.deleteRecord(record.id);
      setFeedback(`${readableDate(record.date)} deleted from the sleep database.`);
      if (latestSaved?.id === record.id) setLatestSaved(null);
      setLoadError("");
      try {
        const history = await sleepHistoryService.getHistory();
        setSavedRecords(history.records);
      } catch (refreshError) {
        setLoadError(refreshError instanceof Error ? `Deleted successfully, but the list could not refresh: ${refreshError.message}` : "Deleted successfully, but the list could not refresh.");
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to delete the sleep record.");
    }
  };

  return <div className="calculator-layout">
    <section className="calculator-panel" aria-labelledby="calculator-form-title">
      <div className="panel-heading">
        <div><p className="panel-eyebrow">Your personal sleep log</p><h2 id="calculator-form-title">Add a sleep day</h2></div>
        <span className="local-only-tag">DATABASE RECORD</span>
      </div>
      <form className="calculator-form" noValidate onSubmit={submit}>
        <div className="calculator-section-title"><span>01</span><h3>Sleep window</h3></div>
        <div className="calculator-grid three-up">
          <div className="calculator-field">
            <label htmlFor="sleep_date">Date you woke up</label>
            <input id="sleep_date" className="control" type="date" max={today} required value={fields.sleep_date}
              aria-invalid={Boolean(errors.sleep_date)} aria-describedby={errors.sleep_date ? "sleep_date-error" : undefined}
              onChange={(event) => change("sleep_date", event.currentTarget.value)} />
            {errors.sleep_date && <p id="sleep_date-error" className="field-error">{errors.sleep_date}</p>}
          </div>
          <ClockField id="bedtime" label="Bedtime" value={fields.bedtime} error={errors.bedtime} onChange={(value) => change("bedtime", value)} />
          <ClockField id="actual_sleep_time" label="Actual sleep time" value={fields.actual_sleep_time} error={errors.actual_sleep_time} onChange={(value) => change("actual_sleep_time", value)} />
          <ClockField id="wake_up_time" label="Wake-up time" value={fields.wake_up_time} error={errors.wake_up_time} onChange={(value) => change("wake_up_time", value)} />
          <ClockField id="get_up_time" label="Get-up time" value={fields.get_up_time} error={errors.get_up_time} onChange={(value) => change("get_up_time", value)} />
        </div>
        <div className="calculator-field">
          <label htmlFor="sleep_notes">Notes <span>optional</span></label>
          <textarea id="sleep_notes" className="control" rows={3} maxLength={2000} value={fields.notes}
            onChange={(event) => change("notes", event.currentTarget.value)} />
        </div>
        <div className="calculator-submit-row">
          <button type="submit" className="download-button save-sleep-button" disabled={pending}>
            {pending ? "Saving…" : <><Check size={15} aria-hidden="true" /> Save sleep day</>}
          </button>
          <p>Sleep duration and timing metrics are calculated by the backend.</p>
        </div>
        {feedback && <p className={feedback.startsWith("Unable") ? "form-alert" : "calculator-feedback"} role={feedback.startsWith("Unable") ? "alert" : "status"}>{feedback}</p>}
        {loadError && <p className="form-alert" role="alert">{loadError}</p>}
      </form>
      {latestSaved && <section className="sleep-summary" aria-labelledby="sleep-summary-title">
        <div className="panel-heading"><div><p className="panel-eyebrow">Backend-calculated metrics</p><h2 id="sleep-summary-title">Today&apos;s sleep analysis</h2></div></div>
        <div className="metric-grid compact">
          <article className="metric-card"><span className="metric-label">Sleep duration</span><strong className="metric-value">{formatDuration(latestSaved.sleep_duration_minutes)}</strong></article>
          <article className="metric-card"><span className="metric-label">Time in bed</span><strong className="metric-value">{formatDuration(latestSaved.time_in_bed_minutes)}</strong></article>
          <article className="metric-card"><span className="metric-label">Sleep onset</span><strong className="metric-value">{latestSaved.sleep_onset_latency_minutes} min</strong></article>
          <article className="metric-card"><span className="metric-label">Get-up latency</span><strong className="metric-value">{latestSaved.get_up_latency_minutes} min</strong></article>
          <article className="metric-card"><span className="metric-label">Sleep efficiency</span><strong className="metric-value">{latestSaved.sleep_efficiency_percent}%</strong></article>
          <article className="metric-card"><span className="metric-label">Mid-sleep time</span><strong className="metric-value">{formatClock(clockToMinutes(latestSaved.mid_sleep_time))}</strong></article>
        </div>
        <div className="sleep-summary-timeline" aria-label="Sleep event timeline">
          {[["Bedtime", latestSaved.bedtime], ["Fell asleep", latestSaved.actual_sleep_time], ["Wake-up", latestSaved.wake_time], ["Got up", latestSaved.get_up_time]].map(([label, value]) => (
            <div key={label}><Clock3 size={15} aria-hidden="true" /><span>{formatClock(clockToMinutes(value))}</span><small>{label}</small></div>
          ))}
        </div>
      </section>}
    </section>

    <aside className="calculator-log" aria-labelledby="saved-records-title">
      <div className="panel-heading"><div><p className="panel-eyebrow">Personal records</p><h2 id="saved-records-title">Your sleep days</h2></div><span className="log-count">{savedRecords.length}</span></div>
      {savedRecords.length ? <div className="saved-record-list">{[...savedRecords].reverse().map((record) => <article className="saved-record" key={record.id ?? record.date}>
        <div className="saved-record-date"><strong>{readableDate(record.date)}</strong><span>{formatDuration(record.sleep_duration_minutes)} · efficiency {record.sleep_efficiency_percent}%</span></div>
        <div className="saved-record-times"><span>{formatClock(clockToMinutes(record.bedtime))}</span><span aria-hidden="true">→</span><span>{formatClock(clockToMinutes(record.wake_time))}</span></div>
        <button type="button" className="icon-button delete-record" aria-label={`Delete sleep record for ${readableDate(record.date)}`} title="Delete sleep day" onClick={() => void removeRecord(record)}><Trash2 size={15} aria-hidden="true" /></button>
      </article>)}</div> : <div className="log-empty"><MoonStar size={21} aria-hidden="true" /><strong>{loadError ? "Sleep records unavailable" : "No sleep records yet"}</strong><span>{loadError ? "Connect to the backend database to load sleep history." : "Add your first sleep record to start analyzing your sleep pattern."}</span></div>}
      <p className="local-storage-note">Sleep days are saved in MySQL through the backend, not in this browser.</p>
    </aside>
  </div>;
}
