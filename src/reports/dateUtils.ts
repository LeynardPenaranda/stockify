import { getAppDayKey } from "@/src/lib/date/appDay";

export function toLocaleDateTimeString(v: any) {
  const d =
    v?.toDate?.() ??
    (v instanceof Date ? v : null) ??
    (typeof v === "string" ? new Date(v) : null);

  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : "";
}

export function isoDay(d = new Date()) {
  return getAppDayKey(d);
}
