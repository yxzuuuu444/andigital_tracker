"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera, Trash2, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { DuckMascot } from "@/components/DuckMascot";
import { useTracker } from "@/lib/tracker-context";
import { useSheets } from "@/components/AppShell";
import { categoryIcon } from "@/lib/icons";
import { previewExpense, spentByCategory } from "@/lib/budget";
import { getSupabase } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { PAYMENT_METHODS, type Expense, type PaymentMethod } from "@/lib/types";
import { cents, peso, todayISO } from "@/lib/format";

type Props = {
  open: boolean;
  editing: Expense | null;
  onClose: () => void;
};

function parseAmount(raw: string) {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? cents(n) : 0;
}

/** Shrinks a phone photo to a small JPEG so uploads stay fast on mobile data. */
async function compressImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that photo"));
      el.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not compress photo"))), "image/jpeg", 0.8),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AddExpenseSheet({ open, editing, onClose }: Props) {
  const { user, categories, expenses, addExpense, updateExpense, deleteExpense, addSavingsDeposit, selectedMonth, pushToast } = useTracker();
  const { notifyLogged } = useSheets();

  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<"expense" | "savings">("expense");

  // Reset the form each time the sheet opens (or switches between add and edit).
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setOverride(false);
    setSaving(false);
    setReceipt(null);
    setKind("expense");
    if (editing) {
      setAmountText(String(editing.amount));
      setCategoryId(editing.category_id);
      setPayment(editing.payment_method);
      setNote(editing.note ?? "");
      setDate(editing.spent_on);
    } else {
      setAmountText("");
      setPayment("Cash");
      setNote("");
      setDate(todayISO());
      setCategoryId((prev) => (categories.some((c) => c.id === prev) ? prev : categories[0]?.id ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // Show the saved receipt when editing an expense that has one.
  useEffect(() => {
    setReceiptUrl(null);
    if (!open || !editing?.receipt_path) return;
    let cancelled = false;
    getSupabase()
      .storage.from("receipts")
      .createSignedUrl(editing.receipt_path, 600)
      .then(({ data }: { data: { signedUrl: string } | null }) => {
        if (!cancelled && data) setReceiptUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editing?.receipt_path]);

  const amount = parseAmount(amountText);
  const category = categories.find((c) => c.id === categoryId);
  const dateMonth = date.slice(0, 7);

  // Spend per category for the month of the chosen date (only available for the viewed month).
  const spentMap = useMemo(() => spentByCategory(expenses), [expenses]);
  const spentBefore = useMemo(() => {
    if (!category || dateMonth !== selectedMonth) return 0;
    let spent = spentMap.get(category.id) ?? 0;
    // When editing, don't count the expense against itself.
    if (editing && editing.category_id === category.id && editing.spent_on.slice(0, 7) === selectedMonth) {
      spent = cents(spent - Number(editing.amount));
    }
    return spent;
  }, [category, dateMonth, selectedMonth, spentMap, editing]);

  const preview = previewExpense(category, spentBefore, amount);
  const showPreview = dateMonth === selectedMonth && !!category && amount > 0;
  const needsOverride = !!preview && preview.blocked;
  const canSave = amount > 0 && !!categoryId && date && (!needsOverride || override) && !saving;

  // Quick repeat: the most recent distinct expenses this month.
  const recent = useMemo(() => {
    if (editing) return [];
    const seen = new Set<string>();
    const out: Expense[] = [];
    for (const e of expenses) {
      const key = `${e.category_id}|${e.amount}|${e.note}|${e.payment_method}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length === 5) break;
    }
    return out;
  }, [expenses, editing]);

  const applyRepeat = (e: Expense) => {
    setCategoryId(e.category_id);
    setAmountText(String(e.amount));
    setPayment(e.payment_method);
    setNote(e.note);
    setOverride(false);
  };

  const remainingLabel = (cat: (typeof categories)[number]) => {
    if (cat.monthly_limit == null) return "No cap";
    const left = cents(cat.monthly_limit - (spentMap.get(cat.id) ?? 0) + (editing?.category_id === cat.id ? Number(editing.amount) : 0));
    return left >= 0 ? `${peso(left)} left` : `${peso(-left)} over`;
  };

  const savingsOK = amount > 0 && !saving;

  // Adds money straight into savings (no category or budget involved).
  const submitSavings = async () => {
    if (!savingsOK) return;
    setSaving(true);
    const ok = await addSavingsDeposit(amount, note.trim());
    setSaving(false);
    if (ok) onClose();
  };

  const submit = async () => {
    if (!canSave || !category) return;
    setSaving(true);
    const payload = {
      category_id: categoryId,
      amount,
      payment_method: payment,
      note: note.trim(),
      spent_on: date,
      over_budget_override: needsOverride && override,
    };

    let savedId: string | false;
    if (editing) {
      savedId = (await updateExpense(editing.id, payload)) ? editing.id : false;
    } else {
      savedId = await addExpense(payload);
    }

    // Attach a receipt photo (skipped for expenses still queued offline).
    if (savedId && receipt && user && !savedId.startsWith("temp-")) {
      try {
        const small = await compressImage(receipt);
        const path = `${user.id}/${savedId}-${Date.now()}.jpg`;
        const { error } = await getSupabase()
          .storage.from("receipts")
          .upload(path, small, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        await updateExpense(savedId, { receipt_path: path });
      } catch (e) {
        pushToast(`Saved, but the receipt didn't upload${e instanceof Error ? `: ${e.message}` : ""}`, "warn");
      }
    }

    setSaving(false);
    if (savedId) {
      if (!editing) {
        notifyLogged();
        if (preview && preview.state !== "ok") {
          notify(
            preview.state === "over" ? "Over budget" : "Budget warning",
            preview.state === "over"
              ? `${category.name} is over by ${peso(preview.overBy)}`
              : `${category.name} is at ${Math.round((preview.projected / (category.monthly_limit || 1)) * 100)}% of its limit`,
          );
        }
      }
      onClose();
    }
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    const ok = await deleteExpense(editing.id);
    setSaving(false);
    if (ok) onClose();
  };

  if (kind === "savings" && !editing) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Add to savings">
        <div className="space-y-5 pt-1">
          <KindToggle kind={kind} onChange={setKind} />

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Amount</span>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/60 glass px-4 focus-within:border-[#8B5CF6] focus-within:ring-2 focus-within:ring-violet-200">
              <span className="text-3xl font-bold text-[#8B5CF6]">₱</span>
              <input
                autoFocus
                inputMode="decimal"
                placeholder="0"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="tabular h-16 w-full bg-transparent text-4xl font-extrabold text-[#7C3AED] outline-none placeholder:text-[#DDD6FE]"
                aria-label="Amount to save"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Note</span>
            <input
              type="text"
              value={note}
              maxLength={200}
              placeholder="e.g. Leftover from the week"
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-white/60 glass px-3 outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-violet-200"
            />
          </label>

          <div className="sticky bottom-0 rounded-2xl glass-strong p-2">
            <button
              type="button"
              onClick={submitSavings}
              disabled={!savingsOK}
              className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] px-4 font-semibold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.98] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Add to savings"}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? "Edit expense" : "Log expense"}>
      <div className="space-y-5 pt-1">
        {!editing && <KindToggle kind={kind} onChange={setKind} />}

        {/* Quick repeat chips */}
        {recent.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Repeat</span>
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              {recent.map((e) => {
                const cat = categories.find((c) => c.id === e.category_id);
                const Icon = categoryIcon(cat?.icon ?? "circle");
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => applyRepeat(e)}
                    className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full glass px-3 text-xs font-semibold text-[#5B21B6] active:scale-95"
                  >
                    <Icon size={14} />
                    {(e.note || cat?.name || "Expense").slice(0, 14)} · {peso(Number(e.amount))}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 1. Amount */}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Amount</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/60 glass px-4 focus-within:border-[#8B5CF6] focus-within:ring-2 focus-within:ring-violet-200">
            <span className="text-3xl font-bold text-[#8B5CF6]">₱</span>
            <input
              autoFocus={!editing}
              inputMode="decimal"
              placeholder="0"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="tabular h-16 w-full bg-transparent text-4xl font-extrabold text-[#7C3AED] outline-none placeholder:text-[#DDD6FE]"
              aria-label="Amount in pesos"
            />
          </div>
        </label>

        {/* 2. Category pills */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Category</span>
          <div className="no-scrollbar mt-2 grid grid-cols-2 gap-2">
            {categories.map((cat) => {
              const Icon = categoryIcon(cat.icon);
              const active = cat.id === categoryId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(cat.id);
                    setOverride(false);
                  }}
                  aria-pressed={active}
                  className={`flex min-h-[52px] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-[#8B5CF6] bg-[#8B5CF6] text-white shadow-md shadow-violet-200"
                      : "glass border-white/60 text-[#2E1065] active:bg-[#EDE9FE]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{cat.name}</span>
                    <span className={`block truncate text-[11px] ${active ? "text-violet-100" : "text-[#6B5F8A]"}`}>
                      {remainingLabel(cat)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live budget preview */}
        <AnimatePresence initial={false}>
          {showPreview && preview && preview.category.monthly_limit != null && (
            <motion.div
              key={preview.state + (preview.overBy > 0 ? "x" : "")}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`overflow-hidden rounded-2xl border p-3 text-sm ${
                preview.state === "over"
                  ? "border-rose-200 bg-rose-50/70 text-rose-700"
                  : preview.state === "warn"
                    ? "border-amber-200 bg-amber-50/70 text-amber-700"
                    : "border-emerald-200 bg-emerald-50/70 text-emerald-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <DuckMascot mood={preview.state === "ok" ? "idle" : "panic"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {preview.state === "over"
                      ? `Exceeds ${preview.category.name} budget by ${peso(preview.overBy)}`
                      : preview.state === "warn"
                        ? `Heads up: ${Math.round((preview.projected / (preview.category.monthly_limit || 1)) * 100)}% of ${preview.category.name} budget`
                        : `${peso(preview.remainingAfter ?? 0)} left in ${preview.category.name}`}
                  </p>
                  <p className="text-xs opacity-80">
                    {peso(preview.projected)} of {peso(preview.category.monthly_limit)} after this expense
                  </p>
                </div>
              </div>

              {needsOverride && (
                <div className="mt-3 rounded-xl glass-strong p-3 text-rose-700">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <AlertTriangle size={16} /> Hard block: lower the amount or confirm override
                  </p>
                  <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(e) => setOverride(e.target.checked)}
                      className="h-5 w-5 accent-rose-500"
                    />
                    Yes, log it anyway (over by {peso(preview.overBy)})
                  </label>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Payment method */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Payment</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => setPayment(pm)}
                aria-pressed={payment === pm}
                className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition ${
                  payment === pm
                    ? "bg-[#DDD6FE] text-[#5B21B6] ring-2 ring-[#8B5CF6]"
                    : "glass text-[#6B5F8A] active:bg-[#EDE9FE]"
                }`}
              >
                {pm}
              </button>
            ))}
          </div>
        </div>

        {/* 4 & 5. Note + Date */}
        <div className="grid grid-cols-5 gap-3">
          <label className="col-span-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Note</span>
            <input
              type="text"
              value={note}
              maxLength={200}
              placeholder="Optional"
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-white/60 glass px-3 outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <label className="col-span-2 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="mt-1 h-11 w-full rounded-xl border border-white/60 glass px-2 text-sm outline-none focus:border-[#8B5CF6]"
            />
          </label>
        </div>

        {/* Receipt photo */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Receipt</span>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl glass px-3 text-sm font-medium text-[#5B21B6] active:scale-95">
              <Camera size={16} />
              {receipt ? "Change photo" : "Attach photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              />
            </label>
            {receipt && (
              <>
                <span className="min-w-0 flex-1 truncate text-[11px] text-[#6B5F8A]">{receipt.name}</span>
                <button type="button" onClick={() => setReceipt(null)} className="grid h-11 w-11 place-items-center rounded-xl text-[#6B5F8A]" aria-label="Remove photo">
                  <X size={16} />
                </button>
              </>
            )}
            {!receipt && receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#7C3AED] underline">
                View saved receipt
              </a>
            )}
          </div>
        </div>

        {/* Actions (sticky so the save button stays reachable while scrolling) */}
        <div className="sticky bottom-0 flex items-center gap-3 rounded-2xl glass-strong p-2">
          {editing &&
            (confirmDelete ? (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="min-h-[52px] flex-1 rounded-2xl bg-rose-500 px-4 font-semibold text-white active:scale-[0.98] disabled:opacity-60"
              >
                Tap again to delete
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete expense"
                className="grid h-[52px] w-[52px] place-items-center rounded-2xl border border-rose-200 text-rose-500 active:bg-rose-50"
              >
                <Trash2 size={20} />
              </button>
            ))}
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="min-h-[52px] flex-1 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] px-4 font-semibold text-white shadow-lg shadow-violet-300/50 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Log expense"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** "Expense" vs "Add to savings" switch shown at the top of the sheet. */
function KindToggle({ kind, onChange }: { kind: "expense" | "savings"; onChange: (k: "expense" | "savings") => void }) {
  return (
    <div role="tablist" aria-label="What are you logging?" className="grid grid-cols-2 gap-1 rounded-2xl bg-white/40 p-1">
      {(
        [
          ["expense", "Expense"],
          ["savings", "Add to savings"],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={kind === k}
          type="button"
          onClick={() => onChange(k)}
          className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
            kind === k ? "glass-strong text-[#7C3AED]" : "text-[#6B5F8A]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
