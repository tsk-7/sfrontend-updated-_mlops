export type SleepRecord = {
  id?: number;
  user_id: string;
  date: string;
  bedtime: string;
  actual_sleep_time: string;
  wake_time: string;
  get_up_time: string;
  notes: string | null;
  sleep_duration_minutes: number;
  time_in_bed_minutes: number;
  sleep_onset_latency_minutes: number;
  get_up_latency_minutes: number;
  sleep_efficiency_percent: number;
  sleep_duration_hours: number;
  mid_sleep_time: string;
  mid_sleep_minutes: number;
  bedtime_trend_minutes: number;
  bedtime_deviation_minutes: number | null;
  wake_time_deviation_minutes: number | null;
  is_weekend: boolean;
};

export type SleepSummary = {
  averageBedtime: number;
  averageWakeTime: number;
  averageDurationMinutes: number;
  averageMidSleep: number | null;
  bedtimeVariability: number | null;
  wakeVariability: number | null;
  durationVariability: number | null;
  consistency: number | null;
  consistencyLabel: string;
  patternLabels: string[];
  weekdayMidSleep: number | null;
  weekendMidSleep: number | null;
  socialJetlag: number | null;
  weekdayBedtime: number | null;
  weekendBedtime: number | null;
  weekdayWake: number | null;
  weekendWake: number | null;
  weekdayDuration: number | null;
  weekendDuration: number | null;
  weekdayWeekendBedtimeDifference: number | null;
  weekdayWeekendWakeDifference: number | null;
  weekdayWeekendDurationDifference: number | null;
};

export type SleepAnalysisSummary = {
  record_count: number;
  average_bedtime_minutes: number | null;
  average_wake_time_minutes: number | null;
  average_sleep_duration_minutes: number | null;
  average_mid_sleep_minutes: number | null;
  bedtime_variability_minutes: number | null;
  wake_time_variability_minutes: number | null;
  sleep_duration_variability_minutes: number | null;
  consistency_index: number | null;
  consistency_label: string;
  weekday_mid_sleep_minutes: number | null;
  weekend_mid_sleep_minutes: number | null;
  social_jetlag_minutes: number | null;
  weekday_weekend_bedtime_difference_minutes: number | null;
  weekday_weekend_wake_time_difference_minutes: number | null;
  weekday_weekend_mid_sleep_difference_minutes: number | null;
  weekday_weekend_sleep_duration_difference_minutes: number | null;
  weekday_bedtime_minutes: number | null;
  weekend_bedtime_minutes: number | null;
  weekday_wake_time_minutes: number | null;
  weekend_wake_time_minutes: number | null;
  weekday_sleep_duration_minutes: number | null;
  weekend_sleep_duration_minutes: number | null;
  pattern_labels: string[];
};

export const CONSISTENCY_METHOD = "Consistency labels are descriptive schedule summaries calculated by the backend. They are not clinical measures.";

const MINUTES_PER_DAY = 1440;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function modulo(value: number, divisor = MINUTES_PER_DAY) {
  return ((value % divisor) + divisor) % divisor;
}

export function clockToMinutes(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return modulo(hours * 60 + minutes);
}

export function formatClock(value: number | null) {
  if (value === null) return "—";
  const minutes = Math.round(modulo(value));
  const hour = Math.floor(minutes / 60);
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatDuration(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, "0")}m`;
}

export function weekdayForDate(date: string) {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

export function durationMinutes(record: SleepRecord) {
  return record.sleep_duration_minutes;
}

export function midSleepMinutes(record: SleepRecord) {
  return record.mid_sleep_minutes;
}

export function bedtimeTrendMinutes(record: SleepRecord) {
  return record.bedtime_trend_minutes;
}

export function timeOfDayForChart(value: number) {
  const minutes = Math.round(value);
  const hour = Math.floor(minutes / 60) % 24;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}
