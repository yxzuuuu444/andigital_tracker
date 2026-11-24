"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTracker } from "@/lib/tracker-context";
import { getSupabase } from "@/lib/supabase/client";
import { cents, monthRange, peso, shiftMonth, shortMonthLabel } from "@/lib/format";

type Row = { amount: number; category_id: string; spent_on: string };

const PALETTE = ["#8B5CF6", "#EC4899", "#38BDF8", "#F59E0B", "#10B981", "#A78BFA"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Charts and comparisons for the selected month, using the last six months of data. */
export function InsightsPanel() {
  const { user, categories, selectedMonth, expenses } = useTracker();
  const [rows, setRows] = useState<Row[] | null>(null);

  // Re-fetch when the viewed month changes or expenses are added/edited.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const from = monthRange(shiftMonth(selectedMonth, -5)).from;
    const to = monthRange(selectedMonth).to;
    getSupabase()
      .from("expenses")
      .select("amount,category_id,spent_on")
      .gte("spent_on", from)
      .lt("spent_on", to)
      .then(({ data }: { data: Row[] | null }) => {
        if (!cancelled) setRows((data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })));
      });
    return () => {
      cancelled = true;
    };
  }, [user, selectedMonth, expenses]);

  const stats = useMemo(() => {
    const data = rows ?? [];
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(selectedMonth, i - 5));
    const totals = new Map<string, number>(months.map((m) => [m, 0]));
    const byCat = new Map<string, number>();
    const byDay = [0, 0, 0, 0, 0, 0, 0];
    for (const r of data) {
      const m = r.spent_on.slice(0, 7);
      if (totals.has(m)) totals.set(m, cents((totals.get(m) ?? 0) + r.amount));
      if (m === selectedMonth) {
        byCat.set(r.category_id, cents((byCat.get(r.category_id) ?? 0) + r.amount));
        const [y, mo, d] = r.spent_on.split("-").map(Number);
        byDay[new Date(y, mo - 1, d).getDay()] += r.amount;
      }
    }
    const series = months.map((m) => ({ month: m, total: totals.get(m) ?? 0 }));
    const current = series[series.length - 1].total;
    const previous = series[series.length - 2].total;
    const delta = previous > 0 ? (current - previous) / previous : null;
    const biggestDay = byDay.reduce((best, v, i) => (v > byDay[best] ? i : best), 0);
    const slices = [...byCat.entries()]
      .map(([id, value]) => ({ id, value, name: categories.find((c) => c.id === id)?.name ?? "Other" }))
      .sort((a, b) => b.value - a.value);
    const top = slices.slice(0, 5);
    const rest = slices.slice(5).reduce((s, x) => s + x.value, 0);
    if (rest > 0) top.push({ id: "other", value: rest, name: "Other" });
    return { series, current, delta, biggestDay: byDay[biggestDay] > 0 ? WEEKDAYS[biggestDay] : null, top, total: current };
  }, [rows, selectedMonth, categories]);

  if (rows === null) {
    return <div className="glass h-44 animate-pulse rounded-3xl" aria-busy="true" />;
  }
  if (stats.total === 0) {
    return (
      <div className="glass rounded-3xl p-5 text-center text-sm text-[#6B5F8A]">
        Log a few expenses and your charts will show up here.
      </div>
    );
  }

  const maxBar = Math.max(1, ...stats.series.map((s) => s.total));
  const up = (stats.delta ?? 0) > 0;

  return (
    <section aria-label="Insights" className="glass space-y-5 rounded-3xl p-5">
      {/* Donut by category */}
      <div className="flex items-center gap-4">
        <Donut slices={stats.top} total={stats.total} />
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {stats.top.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="min-w-0 flex-1 truncate font-medium text-[#2E1065]">{s.name}</span>
              <span className="tabular text-[#6B5F8A]">{Math.round((s.value / stats.total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Six-month bars */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Last 6 months</p>
        <div className="flex h-24 items-end gap-2">
          {stats.series.map((s) => (
            <div key={s.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <motion.div
                className={`w-full rounded-t-lg ${s.month === selectedMonth ? "bg-gradient-to-t from-[#7C3AED] to-[#A78BFA]" : "bg-[#DDD6FE]"}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (s.total / maxBar) * 100)}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                title={`${peso(s.total)}`}
              />
              <span className="truncate text-[10px] text-[#6B5F8A]">{shortMonthLabel(s.month).split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison + biggest day */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl glass p-3">
          <p className="text-[11px] text-[#6B5F8A]">vs last month</p>
          {stats.delta === null ? (
            <p className="font-semibold text-[#2E1065]">No data yet</p>
          ) : (
            <p className={`flex items-center gap-1 font-bold ${up ? "text-rose-600" : "text-emerald-600"}`}>
              {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(Math.round(stats.delta * 100))}% {up ? "more" : "less"}
            </p>
          )}
        </div>
        <div className="rounded-2xl glass p-3">
          <p className="text-[11px] text-[#6B5F8A]">Biggest spending day</p>
          <p className="font-bold text-[#2E1065]">{stats.biggestDay ?? "—"}</p>
        </div>
      </div>
    </section>
  );
}

function Donut({ slices, total }: { slices: { id: string; value: number }[]; total: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#EDE9FE" strokeWidth="14" />
      {slices.map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={s.id}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
