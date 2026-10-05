"use client";

import { Clock3, Download, Moon, Sunrise, Sunset, Target } from "lucide-react";
import { useEffect, useState } from "react";
import type { SleepPageId } from "@/components/sleep-pattern-app";
import {
  CONSISTENCY_METHOD,
  bedtimeTrendMinutes,
  clockToMinutes,
  durationMinutes,
  formatClock,
  formatDuration,
  timeOfDayForChart,
  weekdayForDate,
  type SleepRecord,
  type SleepSummary,
} from "@/lib/sleep-data";
import { sleepHistoryService, type SleepHistory } from "@/lib/sleep-history-service";

type ChartPoint = { date: string; label: string; value: number };

const rangeOptions = [7, 30, 90] as const;
const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function periodLabel(records: Pick<SleepRecord, "date">[]) {
  if (!records.length) return "No records";
  return `${shortDate(records[0].date)} – ${shortDate(records[records.length - 1].date)}`;
}

function recordsLabel(records: SleepRecord[]) {
  return `${records.length} database record${records.length === 1 ? "" : "s"}`;
}

function recordsForDays(records: SleepRecord[], days: number) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const date = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  return records.filter((record) => record.date >= date);
}

function summaryForDays(summaries: SleepHistory["summaries"], days: number): SleepSummary | null {
  if (days === 7) return summaries[7];
  if (days === 30) return summaries[30];
  return summaries[90];
}

function PeriodPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="period-picker" role="group" aria-label="Select date range">
      {rangeOptions.map((days) => <button key={days} type="button" className={value === days ? "selected" : ""} aria-pressed={value === days} onClick={() => onChange(days)}>{days} days</button>)}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone = "blue" }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Moon;
  tone?: string;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-card-top"><span className="metric-icon"><Icon size={17} aria-hidden="true" /></span><span className="metric-label">{label}</span></div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function LineChart({ title, points, formatValue = (value: number) => value.toFixed(1), color = "#4169c8" }: {
  title: string;
  points: ChartPoint[];
  formatValue?: (value: number) => string;
  color?: string;
}) {
  if (!points.length) return <div className="chart-empty">No sleep records available for this period.</div>;
  const width = 720;
  const height = 248;
  const left = 66;
  const right = 15;
  const top = 15;
  const bottom = 39;
  const values = points.map((point) => point.value);
  const spread = Math.max(...values) - Math.min(...values);
  const padding = spread === 0 ? Math.max(Math.abs(values[0]) * 0.04, 1) : spread * 0.18;
  const minimum = Math.min(...values) - padding;
  const maximum = Math.max(...values) + padding;
  const y = (value: number) => top + ((maximum - value) / (maximum - minimum)) * (height - top - bottom);
  const x = (index: number) => left + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - left - right));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");

  return (
    <figure className="chart-figure">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, ${points.length} sleep records`}>
        {[0, 1, 2, 3].map((tick) => {
          const value = maximum - ((maximum - minimum) * tick) / 3;
          const yPosition = y(value);
          return <g key={tick}><line x1={left} y1={yPosition} x2={width - right} y2={yPosition} className="chart-gridline" /><text x={left - 9} y={yPosition + 4} textAnchor="end" className="chart-axis-label">{formatValue(value)}</text></g>;
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <circle key={point.date} cx={x(index)} cy={y(point.value)} r={points.length > 30 ? 2.4 : 4} fill={color} className="chart-point"><title>{`${point.label}: ${formatValue(point.value)}`}</title></circle>)}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, array) => array.indexOf(value) === index).map((index) => <text key={points[index].date} x={x(index)} y={height - 12} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="chart-axis-label">{points[index].label}</text>)}
      </svg>
      <figcaption className="chart-range">{periodLabel(points.map((point) => ({ date: point.date })))}</figcaption>
      <details className="chart-data"><summary>View plotted values</summary><div className="chart-data-list">{points.map((point) => <span key={point.date}>{point.label}: {formatValue(point.value)}</span>)}</div></details>
    </figure>
  );
}

function Panel({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`analytics-panel ${className}`}><div className="panel-heading"> <div>{eyebrow && <p className="panel-eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

function emptyMessage() {
  return <div className="empty-state"><Moon size={20} aria-hidden="true" /><strong>No sleep records yet.</strong><span>Add your first sleep record to start analyzing your sleep pattern.</span></div>;
}

function TimelineTrack({ record }: { record: SleepRecord }) {
  const start = ((clockToMinutes(record.actual_sleep_time) - 18 * 60 + 1440) % 1440) / 1440 * 100;
  const width = durationMinutes(record) / 1440 * 100;
  return <div className="timeline-track" aria-label={`${formatClock(clockToMinutes(record.bedtime))} to ${formatClock(clockToMinutes(record.wake_time))}, ${formatDuration(durationMinutes(record))}`}><span className="timeline-sleep" style={{ left: `${start}%`, width: `${width}%` }} /></div>;
}

function Dashboard({ allRecords, summaries }: { allRecords: SleepRecord[]; summaries: SleepHistory["summaries"] }) {
  const [range, setRange] = useState(30);
  const records = recordsForDays(allRecords, range);
  const summary = summaryForDays(summaries, range);
  if (!summary) return emptyMessage();
  const recent = records.slice(-7);

  return <>
    <div className="section-tools"><span className="data-range-label">{periodLabel(records)} · {recordsLabel(records)}</span><PeriodPicker value={range} onChange={setRange} /></div>
    <div className="metric-grid">
      <MetricCard label="Average bedtime" value={formatClock(summary.averageBedtime)} detail="Across selected nights" icon={Moon} tone="blue" />
      <MetricCard label="Average wake time" value={formatClock(summary.averageWakeTime)} detail="Across selected mornings" icon={Sunrise} tone="teal" />
      <MetricCard label="Average duration" value={formatDuration(summary.averageDurationMinutes)} detail="Sleep window length" icon={Clock3} tone="violet" />
      <MetricCard label="Schedule consistency" value={summary.consistency === null ? "—" : `${summary.consistency}%`} detail={summary.consistency === null ? "Log another night to compare" : "Descriptive timing index"} icon={Target} tone="green" />
      <MetricCard label="Bedtime variability" value={summary.bedtimeVariability === null ? "—" : `±${Math.round(summary.bedtimeVariability)} min`} detail="Needs at least two nights" icon={Sunset} tone="coral" />
      <MetricCard label="Wake-time variability" value={summary.wakeVariability === null ? "—" : `±${Math.round(summary.wakeVariability)} min`} detail="Needs at least two nights" icon={Sunrise} tone="blue" />
      <MetricCard label="Social jetlag" value={formatDuration(summary.socialJetlag)} detail="Weekday vs weekend mid-sleep" icon={ActivityIcon} tone="violet" />
    </div>
    <div className="dashboard-lower-grid">
      <Panel title="Recent sleep windows" eyebrow="Last seven records" action={<a className="text-link" href="/sleep-timeline">Open timeline</a>}>
        <div className="timeline-axis"><span>6 PM</span><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span></div>
        <div className="mini-timeline">{recent.map((record) => <div className="mini-timeline-row" key={record.date}><span>{weekdayForDate(record.date)}</span><TimelineTrack record={record} /><strong>{formatDuration(durationMinutes(record))}</strong></div>)}</div>
      </Panel>
      <Panel title="Weekday & weekend" eyebrow="Selected period">
        <div className="mini-comparison">
          <div className="comparison-head"><span>Measure</span><span>Weekdays</span><span>Weekends</span></div>
          <div><span>Bedtime</span><strong>{formatClock(summary.weekdayBedtime)}</strong><strong>{formatClock(summary.weekendBedtime)}</strong></div>
          <div><span>Wake time</span><strong>{formatClock(summary.weekdayWake)}</strong><strong>{formatClock(summary.weekendWake)}</strong></div>
          <div><span>Duration</span><strong>{formatDuration(summary.weekdayDuration)}</strong><strong>{formatDuration(summary.weekendDuration)}</strong></div>
          <div><span>Mid-sleep</span><strong>{formatClock(summary.weekdayMidSleep)}</strong><strong>{formatClock(summary.weekendMidSleep)}</strong></div>
        </div>
        <div className="demo-calculation">Weekday/weekend values use only matching records in the selected period.</div>
      </Panel>
    </div>
    <Panel title="Sleep duration trend" eyebrow={`Last ${recent.length} nights`} action={<a className="text-link" href="/sleep-trends">Explore trends</a>}>
      <LineChart title="Sleep duration" points={recent.map((record) => ({ date: record.date, label: shortDate(record.date), value: durationMinutes(record) }))} formatValue={(value) => formatDuration(value)} color="#197f8f" />
    </Panel>
  </>;
}

function TimelinePage({ records }: { records: SleepRecord[] }) {
  const recent = records.slice(-7);
  if (!recent.length) return emptyMessage();
  return <Panel title="Night-by-night sleep window" eyebrow={`${periodLabel(recent)} · seven nights`}>
    <div className="timeline-axis large"><span>6 PM</span><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span></div>
    <div className="timeline-list">{recent.map((record) => <article className="timeline-entry" key={record.date}>
      <div className="timeline-date"><strong>{weekdayForDate(record.date)}</strong><span>{shortDate(record.date)}</span></div>
      <div className="timeline-entry-track"><TimelineTrack record={record} /><div className="timeline-times"><span>Bed {formatClock(clockToMinutes(record.bedtime))} · Fell asleep {formatClock(clockToMinutes(record.actual_sleep_time))}</span><span>Wake {formatClock(clockToMinutes(record.wake_time))} · Got up {formatClock(clockToMinutes(record.get_up_time))}</span></div></div>
      <div className="timeline-duration"><strong>{formatDuration(durationMinutes(record))}</strong><span>sleep duration</span></div>
    </article>)}</div>
    <p className="chart-range">Timeline is anchored at 6 PM. Each bar marks actual sleep from sleep onset through wake-up, including nights that cross midnight.</p>
  </Panel>;
}

function TrendsPage({ allRecords }: { allRecords: SleepRecord[] }) {
  const [range, setRange] = useState(30);
  const records = recordsForDays(allRecords, range);
  if (!records.length) return emptyMessage();
  return <>
    <div className="section-tools"><span className="data-range-label">{periodLabel(records)} · {recordsLabel(records)}</span><PeriodPicker value={range} onChange={setRange} /></div>
    <div className="trend-grid">
      <Panel title="Bedtime trend" eyebrow="Local clock time"><LineChart title="Bedtime" points={records.map((record) => ({ date: record.date, label: shortDate(record.date), value: bedtimeTrendMinutes(record) }))} formatValue={timeOfDayForChart} color="#5b62b6" /><p className="chart-note">Times are unwrapped around midnight so 11:50 PM and 12:10 AM remain adjacent.</p></Panel>
      <Panel title="Wake-time trend" eyebrow="Local clock time"><LineChart title="Wake time" points={records.map((record) => ({ date: record.date, label: shortDate(record.date), value: clockToMinutes(record.wake_time) }))} formatValue={timeOfDayForChart} color="#168094" /></Panel>
      <Panel title="Sleep-duration trend" eyebrow="Hours and minutes"><LineChart title="Sleep duration" points={records.map((record) => ({ date: record.date, label: shortDate(record.date), value: durationMinutes(record) }))} formatValue={formatDuration} color="#bd705c" /></Panel>
    </div>
  </>;
}

function ConsistencyPage({ allRecords, summaries }: { allRecords: SleepRecord[]; summaries: SleepHistory["summaries"] }) {
  const [range, setRange] = useState(30);
  const records = recordsForDays(allRecords, range);
  const summary = summaryForDays(summaries, range);
  if (!summary) return emptyMessage();
  const days = records.slice(-7);
  const maxDeviation = Math.max(90, ...days.flatMap((record) => [record.bedtime_deviation_minutes ?? 0, record.wake_time_deviation_minutes ?? 0]));
  return <>
    <div className="section-tools"><span className="data-range-label">{periodLabel(records)} · {recordsLabel(records)}</span><PeriodPicker value={range} onChange={setRange} /></div>
    <div className="consistency-hero"><div><p className="panel-eyebrow">Backend schedule assessment · descriptive</p><strong>{summary.consistencyLabel}</strong><p>{summary.consistency === null ? "More sleep records are needed for this analysis." : "Variability is calculated by the backend with circular clock-time statistics."}</p></div><div className="consistency-ring" style={{ "--consistency": `${summary.consistency ?? 0}%` } as React.CSSProperties}><span>{summary.consistency ?? "—"}</span><small>{summary.consistency === null ? "needs more data" : "/ 100"}</small></div></div>
    <div className="metric-grid compact">
      <MetricCard label="Bedtime variation" value={summary.bedtimeVariability === null ? "—" : `±${Math.round(summary.bedtimeVariability)} min`} detail="Needs at least two nights" icon={Moon} tone="blue" />
      <MetricCard label="Wake-time variation" value={summary.wakeVariability === null ? "—" : `±${Math.round(summary.wakeVariability)} min`} detail="Needs at least two nights" icon={Sunrise} tone="teal" />
      <MetricCard label="Duration variation" value={summary.durationVariability === null ? "—" : `±${Math.round(summary.durationVariability)} min`} detail="Needs at least two nights" icon={Clock3} tone="violet" />
    </div>
    <Panel title="Timing variation over the last week" eyebrow="Distance from period average">
      <div className="variation-chart"><div className="variation-legend"><span><i className="legend-swatch bed" /> Bedtime</span><span><i className="legend-swatch wake" /> Wake time</span></div>
        {days.map((record) => {
          const bedtimeDelta = record.bedtime_deviation_minutes ?? 0;
          const wakeDelta = record.wake_time_deviation_minutes ?? 0;
          return <div className="variation-row" key={record.date}><span>{weekdayForDate(record.date)}</span><div className="variation-bars"><span className="variation-bar bed" style={{ width: `${Math.min(100, bedtimeDelta / maxDeviation * 100)}%` }} title={`${Math.round(bedtimeDelta)} minutes from mean bedtime`} /><span className="variation-bar wake" style={{ width: `${Math.min(100, wakeDelta / maxDeviation * 100)}%` }} title={`${Math.round(wakeDelta)} minutes from mean wake time`} /></div><small>{Math.round(bedtimeDelta)}m / {Math.round(wakeDelta)}m</small></div>;
        })}
      </div>
      <p className="chart-note">Bars show absolute circular clock-time distance from the selected period average; lower values are closer to that average.</p>
    </Panel>
    <p className="method-note">{CONSISTENCY_METHOD}</p>
  </>;
}

function CircadianPage({ allRecords, summaries }: { allRecords: SleepRecord[]; summaries: SleepHistory["summaries"] }) {
  const [range, setRange] = useState(30);
  const records = recordsForDays(allRecords, range);
  const summary = summaryForDays(summaries, range);
  if (!summary) return emptyMessage();
  const weekdayPosition = summary.weekdayMidSleep === null ? null : ((summary.weekdayMidSleep - 18 * 60 + 1440) % 1440) / 1440 * 100;
  const weekendPosition = summary.weekendMidSleep === null ? null : ((summary.weekendMidSleep - 18 * 60 + 1440) % 1440) / 1440 * 100;
  const comparisonRows = [
    { label: "Bedtime", weekday: summary.weekdayBedtime, weekend: summary.weekendBedtime, difference: summary.weekdayWeekendBedtimeDifference },
    { label: "Wake time", weekday: summary.weekdayWake, weekend: summary.weekendWake, difference: summary.weekdayWeekendWakeDifference },
    { label: "Mid-sleep", weekday: summary.weekdayMidSleep, weekend: summary.weekendMidSleep, difference: summary.socialJetlag },
  ];
  return <>
    <div className="section-tools"><span className="data-range-label">{periodLabel(records)} · {recordsLabel(records)}</span><PeriodPicker value={range} onChange={setRange} /></div>
    <div className="circadian-summary"><div className="circadian-main"><p className="panel-eyebrow">Average mid-sleep time</p><strong>{formatClock(summary.averageMidSleep)}</strong><span>All selected records</span></div><div className="circadian-pair"><div><span>Weekday mid-sleep</span><strong>{formatClock(summary.weekdayMidSleep)}</strong></div><div><span>Weekend mid-sleep</span><strong>{formatClock(summary.weekendMidSleep)}</strong></div><div className="social-jetlag"><span>Social jetlag</span><strong>{formatDuration(summary.socialJetlag)}</strong></div></div></div>
    <Panel title="Weekday & weekend timing" eyebrow="24-hour clock · midnight-safe comparison">
      <div className="timeline-axis large"><span>6 PM</span><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span></div>
      <div className="circadian-track">{weekdayPosition !== null && <span className="circadian-mark weekday" style={{ left: `${weekdayPosition}%` }} />}{weekendPosition !== null && <span className="circadian-mark weekend" style={{ left: `${weekendPosition}%` }} />}</div>
      <div className="circadian-legend"><span><i className="legend-swatch bed" /> Weekday mid-sleep · {formatClock(summary.weekdayMidSleep)}</span><span><i className="legend-swatch weekend" /> Weekend mid-sleep · {formatClock(summary.weekendMidSleep)}</span></div>
      <div className="comparison-table"><div className="comparison-table-head"><span>Measure</span><span>Weekdays</span><span>Weekends</span><span>Difference</span></div>
        {comparisonRows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{formatClock(row.weekday)}</strong><strong>{formatClock(row.weekend)}</strong><span>{formatDuration(row.difference)}</span></div>)}
        <div><span>Sleep duration</span><strong>{formatDuration(summary.weekdayDuration)}</strong><strong>{formatDuration(summary.weekendDuration)}</strong><span>{formatDuration(summary.weekdayWeekendDurationDifference)}</span></div>
      </div>
    </Panel>
    <p className="method-note">Social jetlag represents the backend-calculated difference between weekday and weekend average mid-sleep times. It is descriptive and not a health assessment.</p>
  </>;
}

function CalendarPage({ records }: { records: SleepRecord[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const latest = records[records.length - 1];
  if (!latest) return emptyMessage();
  const year = Number(latest.date.slice(0, 4));
  const month = Number(latest.date.slice(5, 7)) - 1;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const firstDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const byDate = new Map(records.map((record) => [record.date, record]));
  const activeDate = selectedDate ?? latest.date;
  const selected = byDate.get(activeDate);
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => {
    if (index < offset) return null;
    const day = index - offset + 1;
    return `${firstDate.slice(0, 8)}${String(day).padStart(2, "0")}`;
  });

  return <div className="calendar-layout"><Panel title={`${monthNames[month]} ${year}`} eyebrow="Select a recorded day">
    <div className="calendar-grid calendar-weekdays">{weekdayNames.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{cells.map((date, index) => {
      if (!date) return <span className="calendar-blank" key={`blank-${index}`} />;
      const record = byDate.get(date);
      return <button type="button" key={date} className={`calendar-day ${record ? "has-record" : ""} ${activeDate === date ? "selected" : ""}`} aria-pressed={activeDate === date} aria-label={record ? `${monthNames[month]} ${index - offset + 1}: ${formatDuration(durationMinutes(record))}, bedtime ${formatClock(clockToMinutes(record.bedtime))}, wake ${formatClock(clockToMinutes(record.wake_time))}` : `${monthNames[month]} ${index - offset + 1}: no record`} onClick={() => setSelectedDate(date)}>
        <span className="calendar-date-number">{index - offset + 1}</span>{record && <><strong>{formatDuration(durationMinutes(record))}</strong><small>{formatClock(clockToMinutes(record.bedtime))}</small></>}
      </button>;
    })}</div>
    <p className="chart-note">Calendar values are loaded from saved database records only.</p>
  </Panel>
  <aside className="day-detail"><p className="panel-eyebrow">Selected sleep record</p><h2>{monthNames[month]} {Number(activeDate.slice(8, 10))}</h2>
    {selected ? <><dl className="detail-list">
      <div><dt>Bedtime</dt><dd>{formatClock(clockToMinutes(selected.bedtime))}</dd></div>
      <div><dt>Actual sleep</dt><dd>{formatClock(clockToMinutes(selected.actual_sleep_time))}</dd></div>
      <div><dt>Wake-up</dt><dd>{formatClock(clockToMinutes(selected.wake_time))}</dd></div>
      <div><dt>Get-up</dt><dd>{formatClock(clockToMinutes(selected.get_up_time))}</dd></div>
      <div><dt>Sleep duration</dt><dd>{formatDuration(durationMinutes(selected))}</dd></div>
      <div><dt>Time in bed</dt><dd>{formatDuration(selected.time_in_bed_minutes)}</dd></div>
      <div><dt>Sleep onset latency</dt><dd>{selected.sleep_onset_latency_minutes} min</dd></div>
      <div><dt>Get-up latency</dt><dd>{selected.get_up_latency_minutes} min</dd></div>
      <div><dt>Sleep efficiency</dt><dd>{selected.sleep_efficiency_percent}%</dd></div>
      {selected.notes && <div><dt>Notes</dt><dd>{selected.notes}</dd></div>}
    </dl></> : <p>No sleep record for this day.</p>}
  </aside></div>;
}

function LifestylePage() {
  return <div className="empty-state"><Moon size={20} aria-hidden="true" /><strong>No lifestyle records are connected.</strong><span>The sleep calculator only collects sleep timing. Lifestyle features remain separate from sleep-pattern calculations.</span></div>;
}

function PatternPage({ allRecords, summaries }: { allRecords: SleepRecord[]; summaries: SleepHistory["summaries"] }) {
  const [range, setRange] = useState(30);
  const records = recordsForDays(allRecords, range);
  const summary = summaryForDays(summaries, range);
  if (!summary) return emptyMessage();
  const tones = ["violet", "green", "coral", "blue", "teal"];
  return <>
    <div className="section-tools"><span className="data-range-label">Backend analysis · {recordsLabel(records)} · {periodLabel(records)}</span><PeriodPicker value={range} onChange={setRange} /></div>
    <div className="rule-summary"><strong>{summary.patternLabels.length} descriptive pattern{summary.patternLabels.length === 1 ? "" : "s"}</strong><span>Pattern labels and thresholds are calculated deterministically by the backend from saved sleep timing.</span></div>
    {summary.patternLabels.length ? <div className="pattern-grid">{summary.patternLabels.map((name, index) => <article className={`pattern-card tone-${tones[index % tones.length]}`} key={name}><span className="pattern-indicator" /><h2>{name}</h2><p>Derived from the selected period’s stored sleep records using the deterministic backend rules.</p><span className="pattern-evidence">{records.length} database records · {periodLabel(records)}</span></article>)}</div> : <div className="empty-state"><Moon size={20} aria-hidden="true" /><strong>More sleep records are needed for this analysis.</strong><span>Add more nights to establish a sleep pattern.</span></div>}
    <Panel title="Rule thresholds" eyebrow="Transparent backend rules"><dl className="rules-list"><div><dt>Consistent Schedule</dt><dd>Bedtime, wake-time, and sleep-duration variability are each 30 minutes or less.</dd></div><div><dt>Moderately Variable Schedule</dt><dd>All three variability measures are 60 minutes or less, but at least one exceeds 30 minutes.</dd></div><div><dt>Irregular Schedule</dt><dd>At least one variability measure exceeds 60 minutes.</dd></div><div><dt>Late / Early Sleeper</dt><dd>Average bedtime is 11 PM or later (through 4 AM), or from 7 PM to before 10 PM.</dd></div><div><dt>Weekend Shifter</dt><dd>Social jetlag is at least 60 minutes.</dd></div><div><dt>Short / Long Sleep Pattern</dt><dd>Average sleep duration is below 7 hours or above 9 hours.</dd></div></dl><p className="chart-note">These labels are descriptive only, not diagnoses or recommendations.</p></Panel>
  </>;
}

function reportCsv(records: SleepRecord[], summary: SleepSummary, range: number) {
  const notEnough = "More sleep records are needed";
  const rows = [
    ["Sleep pattern report", `${range} days`, "Database records"],
    ["Period", periodLabel(records)],
    ["Average bedtime", formatClock(summary.averageBedtime)],
    ["Average wake time", formatClock(summary.averageWakeTime)],
    ["Average sleep duration", formatDuration(summary.averageDurationMinutes)],
    ["Bedtime variability", summary.bedtimeVariability === null ? notEnough : `${Math.round(summary.bedtimeVariability)} min`],
    ["Wake-time variability", summary.wakeVariability === null ? notEnough : `${Math.round(summary.wakeVariability)} min`],
    ["Sleep-duration variability", summary.durationVariability === null ? notEnough : `${Math.round(summary.durationVariability)} min`],
    ["Average mid-sleep", formatClock(summary.averageMidSleep)],
    ["Social jetlag", formatDuration(summary.socialJetlag)],
    ["Weekday / weekend bedtime", `${formatClock(summary.weekdayBedtime)} / ${formatClock(summary.weekendBedtime)}`],
    ["Weekday / weekend wake time", `${formatClock(summary.weekdayWake)} / ${formatClock(summary.weekendWake)}`],
    ["Weekday / weekend sleep-duration difference", formatDuration(summary.weekdayWeekendDurationDifference)],
    ["Sleep pattern classification", summary.patternLabels.join("; ") || notEnough],
    ["Source", "Sleep records saved in MySQL and analyzed by the backend"],
  ].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","));
  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sleep-pattern-report-${range}-days.csv`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReportsPage({ allRecords, summaries }: { allRecords: SleepRecord[]; summaries: SleepHistory["summaries"] }) {
  const [range, setRange] = useState(30);
  const records = recordsForDays(allRecords, range);
  const summary = summaryForDays(summaries, range);
  if (!summary) return emptyMessage();
  const variability = (value: number | null) => value === null ? "More records needed" : `±${Math.round(value)} min`;
  const rows = [
    ["Average bedtime", formatClock(summary.averageBedtime)],
    ["Average wake time", formatClock(summary.averageWakeTime)],
    ["Average sleep duration", formatDuration(summary.averageDurationMinutes)],
    ["Sleep-duration variability", variability(summary.durationVariability)],
    ["Bedtime variability", variability(summary.bedtimeVariability)],
    ["Wake-time variability", variability(summary.wakeVariability)],
    ["Social jetlag", formatDuration(summary.socialJetlag)],
    ["Average mid-sleep", formatClock(summary.averageMidSleep)],
    ["Weekday / weekend bedtimes", `${formatClock(summary.weekdayBedtime)} / ${formatClock(summary.weekendBedtime)}`],
    ["Weekday / weekend wake times", `${formatClock(summary.weekdayWake)} / ${formatClock(summary.weekendWake)}`],
    ["Weekday / weekend sleep-duration difference", formatDuration(summary.weekdayWeekendDurationDifference)],
    ["Pattern classification", summary.patternLabels.join(", ") || "More records needed"],
  ];
  return <>
    <div className="section-tools"><span className="data-range-label">{periodLabel(records)} · {recordsLabel(records)}</span><div className="report-actions"><PeriodPicker value={range} onChange={setRange} /><button type="button" className="download-button" onClick={() => reportCsv(records, summary, range)}><Download size={16} aria-hidden="true" />Download report</button></div></div>
    <Panel title="Sleep pattern summary" eyebrow={`${range}-day report`}>
      <dl className="report-grid">{rows.map(([label, value]) => <div className="report-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="report-source">Source: saved database sleep records. Sleep-quality ML predictions are not included in this sleep-pattern report.</div>
    </Panel>
  </>;
}

const ActivityIcon = Sunrise;

export function SleepPatternPages({ page }: { page: SleepPageId }) {
  const [historyState, setHistoryState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; history: Awaited<ReturnType<typeof sleepHistoryService.getHistory>> }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    const refreshHistory = () => {
      void sleepHistoryService.getHistory().then(
        (history) => {
          if (active) setHistoryState({ status: "ready", history });
        },
        (error: unknown) => {
          if (active) setHistoryState({
            status: "error",
            message: error instanceof Error ? error.message : "Sleep history could not be loaded. Please try again.",
          });
        },
      );
    };
    refreshHistory();
    window.addEventListener("sleep-history-updated", refreshHistory);
    return () => {
      active = false;
      window.removeEventListener("sleep-history-updated", refreshHistory);
    };
  }, []);

  if (historyState.status === "loading") return <div className="data-state" role="status" aria-busy="true"><span className="data-state-spinner" aria-hidden="true" /><strong>Loading sleep records</strong><span>The selected analysis will appear shortly.</span></div>;
  if (historyState.status === "error") return <div className="data-state error" role="alert"><strong>Sleep history unavailable</strong><span>{historyState.message}</span></div>;

  const allRecords = historyState.history.records;
  const summaries = historyState.history.summaries;
  switch (page) {
    case "dashboard": return <Dashboard allRecords={allRecords} summaries={summaries} />;
    case "calculator": return null;
    case "timeline": return <TimelinePage records={allRecords} />;
    case "trends": return <TrendsPage allRecords={allRecords} />;
    case "consistency": return <ConsistencyPage allRecords={allRecords} summaries={summaries} />;
    case "circadian": return <CircadianPage allRecords={allRecords} summaries={summaries} />;
    case "calendar": return <CalendarPage records={allRecords} />;
    case "lifestyle": return <LifestylePage />;
    case "patterns": return <PatternPage allRecords={allRecords} summaries={summaries} />;
    case "reports": return <ReportsPage allRecords={allRecords} summaries={summaries} />;
    case "ml-analysis": return null;
  }
}