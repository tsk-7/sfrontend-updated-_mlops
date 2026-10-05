import type { SleepAnalysisSummary, SleepRecord, SleepSummary } from "@/lib/sleep-data";

export const SLEEP_USER_ID = "local-user";

export type SleepRecordInput = {
  user_id: string;
  sleep_date: string;
  bedtime: string;
  actual_sleep_time: string;
  wake_up_time: string;
  get_up_time: string;
  notes: string | null;
};

export type SleepHistory = {
  source: "backend";
  records: SleepRecord[];
  summaries: Record<7 | 30 | 90, SleepSummary | null>;
  notice: string;
};

type ApiSleepRecord = {
  id: number;
  user_id: string;
  sleep_date: string;
  date: string;
  bedtime: string;
  actual_sleep_time: string;
  wake_up_time: string;
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

type ApiSleepAnalysis = SleepAnalysisSummary & { records: ApiSleepRecord[] };

function errorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const body = payload as { error?: unknown; detail?: unknown; message?: unknown };
    for (const value of [body.error, body.detail, body.message]) {
      if (typeof value === "string") return value;
    }
  }
  return `The sleep service returned HTTP ${status}.`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  let payload: unknown;
  try {
    payload = response.status === 204 ? undefined : await response.json();
  } catch {
    throw new Error("The sleep service returned an invalid response.");
  }
  if (!response.ok) throw new Error(errorMessage(payload, response.status));
  return payload as T;
}

function toSleepRecord(record: ApiSleepRecord): SleepRecord {
  return {
    id: record.id,
    user_id: record.user_id,
    date: record.sleep_date,
    bedtime: record.bedtime,
    actual_sleep_time: record.actual_sleep_time,
    wake_time: record.wake_up_time,
    get_up_time: record.get_up_time,
    notes: record.notes,
    sleep_duration_minutes: record.sleep_duration_minutes,
    time_in_bed_minutes: record.time_in_bed_minutes,
    sleep_onset_latency_minutes: record.sleep_onset_latency_minutes,
    get_up_latency_minutes: record.get_up_latency_minutes,
    sleep_efficiency_percent: record.sleep_efficiency_percent,
    mid_sleep_minutes: record.mid_sleep_minutes,
    bedtime_trend_minutes: record.bedtime_trend_minutes,
    bedtime_deviation_minutes: record.bedtime_deviation_minutes,
    wake_time_deviation_minutes: record.wake_time_deviation_minutes,
    sleep_duration_hours: record.sleep_duration_hours,
    mid_sleep_time: record.mid_sleep_time,
    is_weekend: record.is_weekend,
  };
}

function toSummary(analysis: ApiSleepAnalysis): SleepSummary | null {
  if (!analysis.record_count) return null;
  return {
    averageBedtime: analysis.average_bedtime_minutes ?? 0,
    averageWakeTime: analysis.average_wake_time_minutes ?? 0,
    averageDurationMinutes: analysis.average_sleep_duration_minutes ?? 0,
    averageMidSleep: analysis.average_mid_sleep_minutes,
    bedtimeVariability: analysis.bedtime_variability_minutes,
    wakeVariability: analysis.wake_time_variability_minutes,
    durationVariability: analysis.sleep_duration_variability_minutes,
    consistency: analysis.consistency_index,
    weekdayMidSleep: analysis.weekday_mid_sleep_minutes,
    weekendMidSleep: analysis.weekend_mid_sleep_minutes,
    socialJetlag: analysis.social_jetlag_minutes,
    weekdayBedtime: analysis.weekday_bedtime_minutes,
    weekendBedtime: analysis.weekend_bedtime_minutes,
    weekdayWake: analysis.weekday_wake_time_minutes,
    weekendWake: analysis.weekend_wake_time_minutes,
    weekdayDuration: analysis.weekday_sleep_duration_minutes,
    weekendDuration: analysis.weekend_sleep_duration_minutes,
    consistencyLabel: analysis.consistency_label,
    patternLabels: analysis.pattern_labels,
    weekdayWeekendBedtimeDifference: analysis.weekday_weekend_bedtime_difference_minutes,
    weekdayWeekendWakeDifference: analysis.weekday_weekend_wake_time_difference_minutes,
    weekdayWeekendDurationDifference: analysis.weekday_weekend_sleep_duration_difference_minutes,
  };
}

function historyFromAnalysis(weekly: ApiSleepAnalysis, monthly: ApiSleepAnalysis, pattern: ApiSleepAnalysis): SleepHistory {
  const records = pattern.records.map(toSleepRecord);
  return {
    source: "backend",
    records,
    summaries: {
      7: toSummary(weekly),
      30: toSummary(monthly),
      90: toSummary(pattern),
    },
    notice: records.length
      ? `${records.length} sleep record${records.length === 1 ? "" : "s"} loaded from the database.`
      : "No sleep records yet. Add your first sleep record to start analyzing your sleep pattern.",
  };
}

export const sleepHistoryService = {
  async getHistory(): Promise<SleepHistory> {
    const userId = encodeURIComponent(SLEEP_USER_ID);
    const [weekly, monthly, pattern] = await Promise.all([
      request<ApiSleepAnalysis>(`/api/sleep-analysis/weekly/${userId}`),
      request<ApiSleepAnalysis>(`/api/sleep-analysis/monthly/${userId}`),
      request<ApiSleepAnalysis>(`/api/sleep-analysis/pattern/${userId}`),
    ]);
    if (!Array.isArray(pattern.records)) throw new Error("The sleep service returned an invalid records list.");
    return historyFromAnalysis(weekly, monthly, pattern);
  },

  async saveRecord(record: SleepRecordInput): Promise<SleepRecord> {
    const payload = await request<ApiSleepRecord>("/api/sleep-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    window.dispatchEvent(new Event("sleep-history-updated"));
    return toSleepRecord(payload);
  },

  async deleteRecord(recordId: number): Promise<void> {
    await request<void>(`/api/sleep-records/${recordId}`, { method: "DELETE" });
    window.dispatchEvent(new Event("sleep-history-updated"));
  },
};
