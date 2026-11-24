"use client";

import { PickerField } from "@/components/PickerField";
import { categoryIcon } from "@/lib/icons";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useTracker } from "@/lib/tracker-context";
import { cents, peso } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

type Props = { open: boolean; onClose: () => void };
type Mode = "withdraw" | "deposit";
type Destination = "expense" | "allowance";

export function SavingsSheet({ open, onClose }: Props) {
  const { savingsBalance, categories, withdrawSavings, addSavingsDeposit } = useTracker();
  const [mode, setMode] = useState<Mode>("withdraw");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<Destination>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmountText("");
    setNote("");
    setSaving(false);
    setMode("withdraw");
    setDestination("expense");
    setCategoryId((prev) => (categories.some((c) => c.id === prev) ? prev : categories[0]?.id ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amount = cents(Number(amountText.replace(/,/g, "")) || 0);
  const overBalance = mode === "withdraw" && amount > savingsBalance;
  const needsCategory = mode === "withdraw" && destination === "expense";
  const canSave =
    amount > 0 && !overBalance && !saving && (!needsCategory || !!categoryId);

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
            category_id: destination === "expense" ? categoryId : undefined,
            payment_method: destination === "expense" ? payment : undefined,
          });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={mode === "withdraw" ? "Use / Withdraw Savings" : "Add to Savings"}>
      <div className="space-y-5 pt-1">
        <div className="rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] p-4">
          <p className="text-xs font-semibold text-[#5B21B6]">Available in savings</p>
          <p className="tabular text-2xl font-extrabold text-[#4C1D95]">{peso(savingsBalance)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F5F3FF] p-1">
          {(["withdraw", "deposit"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
                mode === m ? "glass text-[#7C3AED] shadow-sm" : "text-[#6B5F8A]"
              }`}
            >
              {m === "withdraw" ? "Withdraw" : "Deposit"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Amount</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-[#EDE9FE] bg-white/40 px-4 focus-within:border-[#8B5CF6]">
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
          {overBalance && (
            <p className="mt-1 text-sm text-rose-600">That is more than your savings balance.</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Note</span>
          <input
            type="text"
            value={note}
            maxLength={200}
            placeholder={mode === "withdraw" ? "What was it for?" : "Where did it come from?"}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#EDE9FE] glass px-3 outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-violet-200"
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
                      destination === opt.v
                        ? "border-[#8B5CF6] bg-[#F5F3FF] ring-2 ring-[#8B5CF6]/30"
                        : "border-[#EDE9FE] glass"
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
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Category</span>
                  <div className="mt-1">
                    <PickerField
                      title="Category"
                      value={categoryId}
                      onChange={(v) => setCategoryId(v)}
                      options={categories.map((c) => ({ value: c.id, label: c.name, Icon: categoryIcon(c.icon) }))}
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Payment</span>
                  <div className="mt-1">
                    <PickerField
                      title="Payment method"
                      value={payment}
                      onChange={(v) => setPayment(v)}
                      options={PAYMENT_METHODS.map((p) => ({ value: p, label: p }))}
                    />
                  </div>
                </label>
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
    </BottomSheet>
  );
}
