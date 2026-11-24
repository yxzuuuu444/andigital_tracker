"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Trash2, Wallet } from "lucide-react";
import { DuckMascot } from "@/components/DuckMascot";
import { useSheets } from "@/components/AppShell";
import { useTracker } from "@/lib/tracker-context";
import { getSupabase } from "@/lib/supabase/client";
import { categoryIcon } from "@/lib/icons";
import { monthKey, monthLabel, monthRange, peso, prettyDate, shortMonthLabel, shiftMonth } from "@/lib/format";
import { PAYMENT_METHODS, type Expense } from "@/lib/types";

type Tab = "expenses" | "savings";

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("expenses");

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-xl font-extrabold text-[#2E1065]">History</h1>
      </header>

      <div role="tablist" aria-label="History sections" className="grid grid-cols-2 rounded-2xl bg-[#EDE9FE] p-1">
        {([
          ["expenses", "Expenses Log"],
          ["savings", "Savings Pond"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
              tab === key ? "bg-white text-[#7C3AED] shadow-sm" : "text-[#6B5F8A]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "expenses" ? <ExpensesLog /> : <SavingsPond />}
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
          <div className="flex h-11 items-center justify-between rounded-xl border border-[#EDE9FE] bg-white px-1">
            <button type="button" aria-label="Previous month" className="grid h-11 w-9 place-items-center text-[#7C3AED]" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span className="text-sm font-semibold text-[#2E1065]">{shortMonthLabel(month)}</span>
            <button type="button" aria-label="Next month" className="grid h-11 w-9 place-items-center text-[#7C3AED]" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
        </label>
        <select
          aria-label="Filter by category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-11 rounded-xl border border-[#EDE9FE] bg-white px-2 text-sm outline-none focus:border-[#8B5CF6]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by payment method"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          className="col-span-2 h-11 rounded-xl border border-[#EDE9FE] bg-white px-2 text-sm outline-none focus:border-[#8B5CF6]"
        >
          <option value="all">All payment methods</option>
          {PAYMENT_METHODS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="col-span-2 relative block">
          <span className="sr-only">Search notes</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9F94BD]" />
          <input
            type="search"
            placeholder="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#EDE9FE] bg-white pl-9 pr-3 outline-none focus:border-[#8B5CF6]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-[#EDE9FE]">
        <span className="text-xs text-[#6B5F8A]">{visible.length} expense{visible.length === 1 ? "" : "s"} · {monthLabel(month)}</span>
        <span className="tabular text-sm font-bold text-[#7C3AED]">{peso(total)}</span>
      </div>

      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {rows === null ? (
        <p className="py-10 text-center text-sm text-[#6B5F8A]">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#DDD6FE] bg-white p-6 text-center">
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
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#EDE9FE] bg-white px-3 py-2.5 text-left shadow-sm active:bg-[#FAF8FF]"
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

function SavingsPond() {
  const { savings, savingsBalance, deleteSavingsTx } = useTracker();
  const { openSavings } = useSheets();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#EDE9FE] via-white to-[#DDD6FE] p-5 text-center shadow-sm ring-1 ring-[#DDD6FE]">
        <motion.div
          initial={{ y: 4 }}
          animate={{ y: [4, -2, 4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto w-fit"
        >
          <DuckMascot mood="relaxed" variant="rubber" size={130} title="Happy duck on a coin stack" />
        </motion.div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Total saved</p>
        <p className="tabular text-4xl font-extrabold text-[#4C1D95]">{peso(savingsBalance)}</p>
        <button
          type="button"
          onClick={openSavings}
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] px-6 text-sm font-semibold text-white shadow-lg shadow-violet-300/50 active:scale-95"
        >
          <Wallet size={16} /> Withdraw from Savings
        </button>
      </section>

      <div>
        <h2 className="mb-2 text-sm font-bold text-[#2E1065]">Rollovers & withdrawals</h2>
        {savings.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-[#6B5F8A]">
            Nothing here yet. Unspent allowance from each closed month will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {savings.map((s) => {
              const isOut = s.kind === "withdrawal";
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-[#EDE9FE] bg-white px-3 py-2.5 shadow-sm">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${isOut ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                    {isOut ? "−" : "+"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2E1065]">{s.note || (s.kind === "rollover" ? "Rollover" : s.kind === "deposit" ? "Deposit" : "Withdrawal")}</p>
                    <p className="text-[11px] text-[#6B5F8A]">
                      {s.kind === "rollover" ? "Rollover" : s.kind === "deposit" ? "Deposit" : "Withdrawal"} · {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <p className={`tabular text-sm font-bold ${isOut ? "text-rose-600" : "text-emerald-600"}`}>
                    {isOut ? "−" : "+"}
                    {peso(Number(s.amount))}
                  </p>
                  {confirmId === s.id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSavingsTx(s.id);
                        setConfirmId(null);
                      }}
                      className="min-h-[44px] rounded-lg bg-rose-500 px-2 text-xs font-semibold text-white"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Delete ledger entry"
                      onClick={() => setConfirmId(s.id)}
                      className="grid h-11 w-9 place-items-center rounded-lg text-[#9F94BD] active:bg-rose-50 active:text-rose-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-center text-[11px] text-[#9F94BD]">Current month: {shortMonthLabel(monthKey())}</p>
    </div>
  );
}
