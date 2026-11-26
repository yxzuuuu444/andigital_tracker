"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { DuckMascot } from "@/components/DuckMascot";
import { useTracker } from "@/lib/tracker-context";
import { cents, peso } from "@/lib/format";

export function GoalsSection() {
  const { goals, savingsBalance, addGoal, deleteGoal } = useTracker();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const n = Number(target.replace(/,/g, ""));
    if (!name.trim() || !(n > 0)) return;
    setBusy(true);
    const ok = await addGoal(name, cents(n));
    setBusy(false);
    if (ok) {
      setName("");
      setTarget("");
    }
  };

  return (
    <section aria-label="Savings goals" className="space-y-3">
      <h2 className="text-sm font-bold text-[#2E1065]">Goals</h2>
      {goals.length === 0 && (
        <div className="glass flex items-center gap-3 rounded-2xl p-4">
          <DuckMascot mood="empty" size={64} />
          <p className="text-sm text-[#6B5F8A]">Set a goal, like a trip or a new phone, and watch your pond fill toward it.</p>
        </div>
      )}
      {goals.map((g) => {
        const pct = Math.min(1, savingsBalance / g.target);
        const done = savingsBalance >= g.target;
        return (
          <div key={g.id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-[#2E1065]">{done ? "🎉 " : ""}{g.name}</p>
              <button type="button" aria-label={`Delete goal ${g.name}`} onClick={() => deleteGoal(g.id)} className="grid h-9 w-9 place-items-center rounded-lg text-[#9F94BD] active:text-rose-500">
                <Trash2 size={15} />
              </button>
            </div>
            <p className="tabular mt-1 text-xs text-[#6B5F8A]">{peso(Math.max(0, savingsBalance))} of {peso(g.target)} · {Math.round(pct * 100)}%</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/50">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#34D399]" initial={{ width: 0 }} animate={{ width: `${Math.round(pct * 100)}%` }} transition={{ duration: 0.6 }} />
            </div>
          </div>
        );
      })}
      <div className="glass grid grid-cols-5 gap-2 rounded-2xl p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Goal name" aria-label="Goal name" className="col-span-3 h-11 rounded-xl border border-white/60 bg-white/50 px-3 text-sm outline-none focus:border-[#8B5CF6]" />
        <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="₱ target" aria-label="Goal target" className="col-span-2 h-11 rounded-xl border border-white/60 bg-white/50 px-3 text-sm outline-none focus:border-[#8B5CF6]" />
        <button type="button" onClick={add} disabled={busy || !name.trim() || !target} className="col-span-5 min-h-[44px] rounded-xl bg-[#8B5CF6] font-semibold text-white active:scale-[0.98] disabled:opacity-40">
          Add goal
        </button>
      </div>
    </section>
  );
}
