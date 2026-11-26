"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Trash2, Wallet } from "lucide-react";
import { DuckMascot } from "@/components/DuckMascot";
import { useSheets } from "@/components/AppShell";
import { useTracker } from "@/lib/tracker-context";
import { getSupabase } from "@/lib/supabase/client";
import { categoryIcon } from "@/lib/icons";
import { PickerField } from "@/components/PickerField";
import { InsightsPanel } from "@/components/InsightsPanel";
import { cents, monthKey, monthLabel, monthRange, peso, prettyDate, shortMonthLabel, shiftMonth } from "@/lib/format";
import { PAYMENT_METHODS, type Expense } from "@/lib/types";

type Tab = "expenses" | "insights";

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("expenses");

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <div className="flex items-center gap-2">
          <DuckMascot mood="idle" size={36} />
          <h1 className="text-xl font-extrabold text-[#2E1065]">History</h1>
        </div>
      </header>

      <div role="tablist" aria-label="History sections" className="grid grid-cols-2 rounded-2xl bg-[#EDE9FE] p-1">
        {([
          ["expenses", "Expenses Log"],
          ["insights", "Insights"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
              tab === key ? "glass text-[#7C3AED] shadow-sm" : "text-[#6B5F8A]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "expenses" && <ExpensesLog />}
      {tab === "insights" && <InsightsPanel />}
    </div>
  );
}

function ExpensesLog() {
  const { categories, currentMonth, user, expenses: liveExpenses } = useTracker();
  const { openExpense } = useSheets();
  const [month, setMonth] = useState(currentMonth);
  const [categoryId, setCategoryId] = useState("all");
  const [payment, setPayment] = useState("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-query whenever the filters change. Note search is applied client-side for responsiveness.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const { from, to } = monthRange(month);
      let q = getSupabase()
        .from("expenses")
        .select("*")
        .gte("spent_on", from)
        .lt("spent_on", to)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (payment !== "all") q = q.eq("payment_method", payment);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as Expense[]);
    })();
    return () => {
      cancelled = true;
    };
    // liveExpenses changes whenever the sheet adds/edits/deletes, so the log stays in sync.
  }, [month, categoryId, payment, user, liveExpenses]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.note.toLowerCase().includes(needle));
  }, [rows, query]);

  const total = visible.reduce((s, r) => s + Number(r.amount), 0);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="sr-only">Month</span>
          <div className="flex h-11 items-center justify-between rounded-xl border border-[#EDE9FE] glass px-1">
            <button type="button" aria-label="Previous month" className="grid h-11 w-9 place-items-center text-[#7C3AED]" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span className="text-sm font-semibold text-[#2E1065]">{shortMonthLabel(month)}</span>
            <button type="button" aria-label="Next month" className="grid h-11 w-9 place-items-center text-[#7C3AED]" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
        </label>
        <PickerField
          title="Filter by category"
          value={categoryId}
          onChange={(v) => setCategoryId(v)}
          options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name, Icon: categoryIcon(c.icon) }))]}
        />
        <div className="col-span-2">
          <PickerField
            title="Filter by payment method"
            value={payment}
            onChange={(v) => setPayment(v)}
            options={[{ value: "all", label: "All payment methods" }, ...PAYMENT_METHODS.map((p) => ({ value: p, label: p }))]}
          />
        </div>
        <label className="col-span-2 relative block">
          <span className="sr-only">Search notes</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9F94BD]" />
          <input
            type="search"
            placeholder="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#EDE9FE] glass pl-9 pr-3 outline-none focus:border-[#8B5CF6]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-2xl glass px-4 py-3 ring-1 ring-[#EDE9FE]">
        <span className="text-xs text-[#6B5F8A]">{visible.length} expense{visible.length === 1 ? "" : "s"} · {monthLabel(month)}</span>
        <span className="tabular text-sm font-bold text-[#7C3AED]">{peso(total)}</span>
      </div>

      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {rows === null ? (
        <p className="py-10 text-center text-sm text-[#6B5F8A]">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#DDD6FE] glass p-6 text-center">
          <DuckMascot mood="empty" size={88} />
          <p className="mt-2 text-sm font-semibold text-[#5B21B6]">Nothing matches here yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((e) => {
            const cat = categories.find((c) => c.id === e.category_id);
            const Icon = categoryIcon(cat?.icon ?? "circle");
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openExpense(e)}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#EDE9FE] glass px-3 py-2.5 text-left shadow-sm active:bg-white/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5F3FF] text-[#7C3AED]">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2E1065]">{e.note || catName(e.category_id)}</p>
                    <p className="text-[11px] text-[#6B5F8A]">
                      {catName(e.category_id)} · {e.payment_method} · {prettyDate(e.spent_on)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-bold text-[#2E1065]">{peso(Number(e.amount))}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-center text-[11px] text-[#9F94BD]">Showing up to 500 expenses per month.</p>
    </div>
  );
}
