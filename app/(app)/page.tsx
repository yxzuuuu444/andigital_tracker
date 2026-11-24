"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Lock, PiggyBank, Settings as SettingsIcon, Users } from "lucide-react";
import { DuckMascot } from "@/components/DuckMascot";
import { useSheets } from "@/components/AppShell";
import { useTracker } from "@/lib/tracker-context";
import { computeMonthStats } from "@/lib/month-stats";
import { categoryIcon } from "@/lib/icons";
import { InsightsPanel } from "@/components/InsightsPanel";
import { monthLabel, peso, prettyDate, shiftMonth } from "@/lib/format";
import { otherProfile, profileLabel } from "@/lib/profiles";
import type { Expense } from "@/lib/types";

export default function HomePage() {
  const { categories, allowances, expenses, savingsBalance, selectedMonth, setSelectedMonth, currentMonth, ready, activeProfile, switchProfile } = useTracker();
  const { openExpense, openSavings } = useSheets();
  const stats = computeMonthStats(categories, allowances, expenses);
  const isCurrent = selectedMonth === currentMonth;

  const barColor =
    stats.pctSpent > 1 ? "bg-[#F43F5E]" : stats.pctSpent >= 0.8 ? "bg-[#F59E0B]" : "bg-[#10B981]";
  const progressPct = Math.min(100, Math.round(stats.pctSpent * 100));

  const mood = expenses.length === 0 ? "empty" : stats.worstOver ? "panic" : "idle";

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="grid h-11 w-11 place-items-center rounded-2xl glass shadow-sm ring-1 ring-[#EDE9FE]">
            <DuckMascot mood="idle" size={34} />
          </div>
          <div>
            <h1 className="text-base font-extrabold leading-tight text-[#2E1065]">Andigital Tracker</h1>
            <p className="text-[11px] text-[#6B5F8A]">Your wallet, your rules</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={switchProfile}
            aria-label={`Switch to ${profileLabel(otherProfile(activeProfile))}`}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full glass px-3 text-xs font-semibold text-[#7C3AED] shadow-sm ring-1 ring-[#EDE9FE] active:bg-[#F5F3FF]"
          >
            <Users size={16} />
            {profileLabel(activeProfile)}
          </button>
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid h-11 w-11 place-items-center rounded-full text-[#6B5F8A] active:bg-[#EDE9FE]"
          >
            <SettingsIcon size={20} />
          </Link>
        </div>
      </header>

      {/* Month switcher */}
      <div className="flex items-center justify-between rounded-2xl glass px-2 py-1 shadow-sm ring-1 ring-[#EDE9FE]">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          className="grid h-11 w-11 place-items-center rounded-xl text-[#7C3AED] active:bg-[#F5F3FF]"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-[#2E1065]" aria-live="polite">{monthLabel(selectedMonth)}</p>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
              className="text-[11px] font-semibold text-[#8B5CF6]"
            >
              Back to this month
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          className="grid h-11 w-11 place-items-center rounded-xl text-[#7C3AED] active:bg-[#F5F3FF]"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Prompt for this month's allowance */}
      {ready && isCurrent && !stats.hasBase && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-3xl border border-[#DDD6FE] bg-gradient-to-br from-[#F5F3FF] to-white p-4"
        >
          <DuckMascot mood="empty" size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#4C1D95]">What&apos;s your allowance this month?</p>
            <p className="text-xs text-[#6B5F8A]">Enter it in Settings. You can still log expenses now.</p>
            <Link href="/settings" className="mt-2 inline-flex min-h-[40px] items-center rounded-full bg-[#8B5CF6] px-4 text-xs font-semibold text-white">
              Set allowance
            </Link>
          </div>
        </motion.div>
      )}

      {/* Hero balance */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED] p-5 text-white shadow-xl shadow-violet-300/40">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-100">Remaining allowance</p>
            <p className="tabular mt-1 text-4xl font-extrabold leading-none">
              {stats.remaining < 0 ? "-" : ""}
              {peso(Math.abs(stats.remaining))}
            </p>
            <p className="mt-2 text-xs text-violet-100">
              Spent {peso(stats.totalSpent)} of {peso(stats.totalAllowance)}
            </p>
          </div>
          <button
            type="button"
            onClick={openSavings}
            aria-label={`Savings ${peso(savingsBalance)}, open savings`}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 text-sm font-bold ring-1 ring-white/30 backdrop-blur active:bg-white/30"
          >
            <PiggyBank size={16} />
            <span className="tabular">{peso(savingsBalance)}</span>
            <span className="text-xs font-medium text-violet-100">Saved</span>
          </button>
        </div>

        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Spent versus allowance">
            <motion.div
              className={`h-full rounded-full ${stats.pctSpent > 1 ? "bg-rose-300" : stats.pctSpent >= 0.8 ? "bg-amber-300" : "bg-emerald-300"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, progressPct)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-violet-100">{progressPct}% of allowance used</p>
        </div>
      </section>

      {/* Over-budget banner (soft or hard) */}
      {stats.worstOver && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-700"
        >
          <DuckMascot mood="panic" size={44} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-bold">
              <AlertTriangle size={14} /> Over budget
            </p>
            <p className="text-sm">Exceeds {stats.worstOver.name} budget by {peso(stats.worstOver.overBy)}</p>
          </div>
        </motion.div>
      )}

      {/* Savings card — duck relaxes on the coin stack when healthy */}
      <section className="flex items-center gap-3 rounded-3xl border border-[#EDE9FE] glass p-4 shadow-sm">
        <DuckMascot mood="relaxed" variant="rubber" size={64} title="Relaxed duck on coin stack" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Savings pond</p>
          <p className="tabular text-xl font-extrabold text-[#5B21B6]">{peso(savingsBalance)}</p>
          <p className="text-[11px] text-[#6B5F8A]">Unspent money rolls here every month.</p>
        </div>
        <button
          type="button"
          onClick={openSavings}
          className="min-h-[44px] rounded-full bg-[#DDD6FE] px-4 text-sm font-semibold text-[#5B21B6] active:scale-95"
        >
          Use
        </button>
      </section>

      {/* Insights: donut, six-month bars, comparison */}
      <InsightsPanel />

      {/* Category budgets */}
      <section aria-labelledby="cat-h" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="cat-h" className="text-sm font-bold text-[#2E1065]">Category budgets</h2>
          <Link href="/settings#categories" className="text-xs font-semibold text-[#8B5CF6]">Manage</Link>
        </div>
        {categories.length === 0 ? (
          <p className="rounded-2xl glass p-4 text-sm text-[#6B5F8A]">Loading categories…</p>
        ) : (
          <div className="grid gap-3">
            {stats.byCategory.map(({ category, spent, limit, remaining, pct, state }) => {
              const Icon = categoryIcon(category.icon);
              const barC = state === "over" ? "bg-[#F43F5E]" : state === "warn" ? "bg-[#F59E0B]" : "bg-[#10B981]";
              return (
                <div key={category.id} className="rounded-2xl border border-[#EDE9FE] glass p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5F3FF] text-[#7C3AED]">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-[#2E1065]">{category.name}</p>
                        {category.limit_mode === "hard_block" && category.monthly_limit != null && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#2E1065] px-1.5 py-0.5 text-[10px] font-semibold text-white" title="Hard block">
                            <Lock size={10} /> Hard
                          </span>
                        )}
                      </div>
                      <p className="tabular text-xs text-[#6B5F8A]">
                        {peso(spent)}
                        {limit != null ? ` / ${peso(limit)}` : " · no cap"}
                      </p>
                    </div>
                    {remaining != null && (
                      <p className={`tabular shrink-0 text-right text-xs font-bold ${remaining < 0 ? "text-rose-600" : "text-[#7C3AED]"}`}>
                        {remaining < 0 ? `${peso(-remaining)} over` : `${peso(remaining)} left`}
                      </p>
                    )}
                  </div>
                  {limit != null && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F5F3FF]">
                      <motion.div
                        className={`h-full rounded-full ${barC}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent expenses */}
      <section aria-labelledby="recent-h" className="space-y-3">
        <h2 id="recent-h" className="text-sm font-bold text-[#2E1065]">Recent expenses</h2>
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#DDD6FE] glass p-6 text-center">
            <DuckMascot mood={mood === "empty" ? "empty" : "idle"} size={96} />
            <p className="mt-2 text-sm font-semibold text-[#5B21B6]">No expenses yet—your duck is chilling!</p>
            <p className="text-xs text-[#6B5F8A]">Tap the + button to log your first one.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {expenses.slice(0, 12).map((e) => (
              <ExpenseRow key={e.id} expense={e} categoryName={categories.find((c) => c.id === e.category_id)?.name ?? "—"} categoryIcon={categories.find((c) => c.id === e.category_id)?.icon ?? "circle"} onOpen={() => openExpense(e)} />
            ))}
          </ul>
        )}
      </section>

      {/* Quick-log FAB spacer already handled by layout padding */}
      <div className="h-2" />
    </div>
  );
}

function ExpenseRow({
  expense,
  categoryName,
  categoryIcon: iconKey,
  onOpen,
}: {
  expense: Expense;
  categoryName: string;
  categoryIcon: string;
  onOpen: () => void;
}) {
  const Icon = categoryIcon(iconKey);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#EDE9FE] glass px-3 py-2.5 text-left shadow-sm transition active:scale-[0.99] active:bg-white/40"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5F3FF] text-[#7C3AED]">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#2E1065]">{expense.note || categoryName}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B5F8A]">
            <span className="truncate">{categoryName}</span>
            <span className="rounded-full bg-[#EDE9FE] px-1.5 py-px font-medium text-[#5B21B6]">{expense.payment_method}</span>
            <span>· {prettyDate(expense.spent_on)}</span>
            {expense.over_budget_override && <span className="font-semibold text-rose-600">· override</span>}
          </p>
        </div>
        <p className="tabular shrink-0 text-sm font-bold text-[#2E1065]">{peso(Number(expense.amount))}</p>
      </button>
    </li>
  );
}
