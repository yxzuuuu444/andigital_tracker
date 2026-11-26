"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { DuckMascot } from "@/components/DuckMascot";
import { SavingsForm, type SavingsMode } from "@/components/SavingsForm";
import { GoalsSection } from "@/components/SavingsGoals";
import { useTracker } from "@/lib/tracker-context";
import { peso } from "@/lib/format";

export default function SavingsPage() {
  const { savings, savingsBalance, deleteSavingsTx } = useTracker();
  const [mode, setMode] = useState<SavingsMode>("deposit");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-2">
        <DuckMascot mood="idle" size={36} />
        <h1 className="text-xl font-extrabold text-[#2E1065]">Savings</h1>
      </header>

      {/* Balance */}
      <section className="glass relative overflow-hidden rounded-3xl p-5 text-center">
        <motion.div initial={{ y: 4 }} animate={{ y: [4, -2, 4] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="mx-auto w-fit">
          <DuckMascot mood="relaxed" variant="rubber" size={120} title="Happy duck on a coin stack" />
        </motion.div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Total saved</p>
        <p className="tabular text-4xl font-extrabold text-[#4C1D95]">{peso(savingsBalance)}</p>
        <p className="mt-1 text-[11px] text-[#6B5F8A]">Unspent allowance rolls in here each month.</p>
      </section>

      {/* Add or withdraw, inline */}
      <section className="glass rounded-3xl p-4">
        <SavingsForm mode={mode} onModeChange={setMode} />
      </section>

      <GoalsSection />

      {/* Ledger */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#2E1065]">Rollovers & withdrawals</h2>
        {savings.length === 0 ? (
          <p className="glass rounded-2xl p-4 text-sm text-[#6B5F8A]">Nothing here yet. Unspent allowance from each closed month will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {savings.map((s) => {
              const isOut = s.kind === "withdrawal";
              const label = s.kind === "rollover" ? "Rollover" : s.kind === "deposit" ? "Deposit" : "Withdrawal";
              return (
                <li key={s.id} className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${isOut ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                    {isOut ? "−" : "+"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2E1065]">{s.note || label}</p>
                    <p className="text-[11px] text-[#6B5F8A]">
                      {label} · {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                    <button type="button" aria-label="Delete ledger entry" onClick={() => setConfirmId(s.id)} className="grid h-11 w-9 place-items-center rounded-lg text-[#9F94BD] active:text-rose-500">
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
