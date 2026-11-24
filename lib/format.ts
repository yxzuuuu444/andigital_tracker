const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** ₱1,234.50 style. Negative values keep their sign. */
export function peso(value: number) {
  return phpFormatter.format(value);
}

/** Round to cents to avoid float drift in sums. */
export function cents(value: number) {
  return Math.round(value * 100) / 100;
}

/** Local-timezone YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM for the given date (local). */
export function monthKey(d = new Date()) {
  return todayISO(d).slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function shortMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Inclusive start and exclusive end date for a month, as YYYY-MM-DD. */
export function monthRange(month: string) {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` };
}

export function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
