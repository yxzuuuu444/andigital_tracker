"use client";

import { useState } from "react";
import { PickerField } from "@/components/PickerField";
import { categoryIcon } from "@/lib/icons";
import { useTracker } from "@/lib/tracker-context";
import { cents } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

export type SavingsMode = "withdraw" | "deposit";
type Destination = "expense" | "allowance";

/** Add money to savings, or withdraw it. Lives inline on the Savings page. */
export function SavingsForm({ mode, onModeChange }: { mode: SavingsMode; onModeChange: (m: SavingsMode) => void }) {
  const { savingsBalance, categories, withdrawSavings, addSavingsDeposit } = useTracker();
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<Destination>("expense");
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? "");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [saving, setSaving] = useState(false);

  const amount = cents(Number(amountText.replace(/,/g, "")) || 0);
  const overBalance = mode === "withdraw" && amount > savingsBalance;
  const needsCategory = mode === "withdraw" && destination === "expense";
  const selectedCategory = categoryId || categories[0]?.id || "";
  const canSave = amount > 0 && !overBalance && !saving && (!needsCategory || !!selectedCategory);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok =
      mode === "deposit"
        ? await addSavingsDeposit(amount, note.trim())
        : await withdrawSavings({
            amount,
            note: note.trim(),
            destination,
            category_id: destination === "expense" ? selectedCategory : undefined,
            payment_method: destination === "expense" ? payment : undefined,
          });
    setSaving(false);
    if (ok) {
      setAmountText("");
      setNote("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
              mode === m ? "glass-strong text-[#7C3AED]" : "text-[#6B5F8A]"
            }`}
          >
            {m === "deposit" ? "Add money" : "Withdraw"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Amount</span>
        <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/60 glass px-4 focus-within:border-[#8B5CF6]">
          <span className="text-2xl font-bold text-[#8B5CF6]">₱</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ""))}
            className="tabular h-14 w-full bg-transparent text-3xl font-extrabold text-[#7C3AED] outline-none placeholder:text-[#DDD6FE]"
            aria-label="Amount in pesos"
          />
        </div>
        {overBalance && <p className="mt-1 text-sm text-rose-600">That is more than your savings balance.</p>}
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Note</span>
        <input
          type="text"
          value={note}
          maxLength={200}
          placeholder={mode === "withdraw" ? "What was it for?" : "Where did it come from?"}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-white/60 glass px-3 outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-violet-200"
        />
      </label>

      {mode === "withdraw" && (
        <>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Use it as</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { v: "expense" as const, t: "Outside expense", d: "Counts against this month" },
                { v: "allowance" as const, t: "Add to allowance", d: "Top up this month" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setDestination(opt.v)}
                  aria-pressed={destination === opt.v}
                  className={`min-h-[60px] rounded-2xl border p-3 text-left transition ${
                    destination === opt.v ? "border-[#8B5CF6] bg-[#8B5CF6]/15 ring-2 ring-[#8B5CF6]/30" : "glass border-white/60"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[#2E1065]">{opt.t}</span>
                  <span className="block text-[11px] text-[#6B5F8A]">{opt.d}</span>
                </button>
              ))}
            </div>
          </div>

          {destination === "expense" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Category</span>
                <div className="mt-1">
                  <PickerField
                    title="Category"
                    value={selectedCategory}
                    onChange={(v) => setCategoryId(v)}
                    options={categories.map((c) => ({ value: c.id, label: c.name, Icon: categoryIcon(c.icon) }))}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Payment</span>
                <div className="mt-1">
                  <PickerField
                    title="Payment method"
                    value={payment}
                    onChange={(v) => setPayment(v)}
                    options={PAYMENT_METHODS.map((p) => ({ value: p, label: p }))}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSave}
        className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] px-4 font-semibold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {saving ? "Saving…" : mode === "withdraw" ? "Withdraw from Savings" : "Add to Savings"}
      </button>
    </div>
  );
}
