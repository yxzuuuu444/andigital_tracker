"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Moon, Repeat, ShieldCheck, Sun, Trash2, Upload } from "lucide-react";
import { PickerField } from "@/components/PickerField";
import { Fold } from "@/components/Fold";
import { useTracker } from "@/lib/tracker-context";
import { getSupabase } from "@/lib/supabase/client";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { cents, peso } from "@/lib/format";
import { parseCsv } from "@/lib/csv";
import { setPin, clearPin, hasPin, lock, checkPin } from "@/lib/pin";
import { notificationsSupported, notificationsGranted, requestNotifications } from "@/lib/notify";
import { profileLabel } from "@/lib/profiles";
import { categoryIcon } from "@/lib/icons";

const card = "glass space-y-3 rounded-3xl p-4";
const label = "text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]";
const input = "h-11 w-full rounded-xl border border-white/60 bg-white/50 px-3 text-sm outline-none focus:border-[#8B5CF6]";

// ----------------------------------------------------------- recurring
export function RecurringSection() {
  const { recurring, categories, addRecurring, toggleRecurring, deleteRecurring } = useTracker();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");
  const [day, setDay] = useState("1");

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const save = async () => {
    const n = cents(Number(amount.replace(/,/g, "")));
    const d = Math.min(28, Math.max(1, Number(day) || 1));
    if (!(n > 0) || !categoryId) return;
    const ok = await addRecurring({ category_id: categoryId, amount: n, payment_method: payment, note: note.trim(), day_of_month: d });
    if (ok) {
      setAmount("");
      setNote("");
    }
  };

  return (
    <Fold title={<span className="flex items-center gap-2"><Repeat size={16} /> Recurring expenses</span>}>
      <p className="text-xs text-[#6B5F8A]">Bills and subscriptions are logged automatically on their day each month. Days 1–28 only.</p>

      {recurring.map((r) => {
        const cat = categories.find((c) => c.id === r.category_id);
        const Icon = categoryIcon(cat?.icon ?? "circle");
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/40 p-3">
            <Icon size={16} className="shrink-0 text-[#7C3AED]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#2E1065]">{r.note || cat?.name || "Recurring"} · {peso(Number(r.amount))}</p>
              <p className="text-[11px] text-[#6B5F8A]">Day {r.day_of_month} · {r.payment_method}</p>
            </div>
            <label className="flex min-h-[44px] items-center gap-1 text-[11px] text-[#6B5F8A]">
              <input type="checkbox" checked={r.active} onChange={(e) => toggleRecurring(r.id, e.target.checked)} className="h-5 w-5 accent-[#8B5CF6]" />
              On
            </label>
            <button type="button" aria-label="Delete recurring" onClick={() => deleteRecurring(r.id)} className="grid h-11 w-9 place-items-center text-rose-500">
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      <div className="grid grid-cols-5 gap-2 border-t border-white/60 pt-3">
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="₱ amount" aria-label="Recurring amount" className={`${input} col-span-2`} />
        <input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day of month" className={`${input} col-span-1`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (e.g. Netflix)" aria-label="Recurring note" className={`${input} col-span-2`} />
        <div className="col-span-5 grid grid-cols-2 gap-2">
          <PickerField title="Category" value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name, Icon: categoryIcon(c.icon) }))} />
          <PickerField title="Payment method" value={payment} onChange={setPayment} options={PAYMENT_METHODS.map((p) => ({ value: p, label: p }))} />
        </div>
        <button type="button" onClick={save} className="col-span-5 min-h-[44px] rounded-xl bg-[#8B5CF6] font-semibold text-white active:scale-[0.98]">Add recurring expense</button>
      </div>
    </Fold>
  );
}

// ----------------------------------------------------------- PIN
export function PinSection() {
  const { activeProfile, pushToast } = useTracker();
  const [enabled, setEnabled] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [current, setCurrent] = useState("");

  useEffect(() => setEnabled(hasPin(activeProfile)), [activeProfile]);

  const enable = async () => {
    if (!/^\d{4}$/.test(newPin)) return pushToast("PIN must be 4 digits", "error");
    await setPin(activeProfile, newPin);
    setNewPin("");
    setEnabled(true);
    pushToast(`${profileLabel(activeProfile)} is PIN protected`);
  };

  const disable = async () => {
    if (!(await checkPin(activeProfile, current))) return pushToast("Wrong PIN", "error");
    clearPin(activeProfile);
    setCurrent("");
    setEnabled(false);
    pushToast("PIN removed");
  };

  const lockNow = () => {
    lock(activeProfile);
    window.dispatchEvent(new Event("andigital-lock"));
  };

  return (
    <Fold title={<span className="flex items-center gap-2"><ShieldCheck size={16} /> PIN lock · {profileLabel(activeProfile)}</span>}>
      <p className="text-xs text-[#6B5F8A]">Keeps this profile hidden on a shared device. It is not real security: anyone with the link can still reach the data.</p>
      {enabled ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="password" inputMode="numeric" maxLength={4} value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} placeholder="Current PIN" aria-label="Current PIN" className={input} />
            <button type="button" onClick={disable} className="min-h-[44px] shrink-0 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white">Remove</button>
          </div>
          <button type="button" onClick={lockNow} className="min-h-[44px] w-full rounded-xl bg-[#2E1065] text-sm font-semibold text-white active:scale-[0.98]">Lock now</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="4-digit PIN" aria-label="New PIN" className={input} />
          <button type="button" onClick={enable} className="min-h-[44px] shrink-0 rounded-xl bg-[#8B5CF6] px-4 text-sm font-semibold text-white">Set PIN</button>
        </div>
      )}
    </Fold>
  );
}

// ----------------------------------------------------------- notifications
export function NotificationsSection() {
  const [supported] = useState(() => notificationsSupported());
  const [granted, setGranted] = useState(false);
  useEffect(() => setGranted(notificationsGranted()), []);

  const enable = async () => {
    const result = await requestNotifications();
    setGranted(result === "granted");
  };

  return (
    <Fold title={<span className="flex items-center gap-2">{granted ? <Bell size={16} /> : <BellOff size={16} />} Budget alerts</span>}>
      {!supported ? (
        <p className="text-xs text-[#6B5F8A]">This browser doesn&apos;t support notifications.</p>
      ) : granted ? (
        <p className="text-xs text-emerald-700">On. You&apos;ll get an alert when a category reaches its warning line while the app is open.</p>
      ) : (
        <>
          <p className="text-xs text-[#6B5F8A]">Get an alert when a category reaches 80% or goes over. Alerts show while the app is open.</p>
          <button type="button" onClick={enable} className="min-h-[44px] w-full rounded-xl bg-[#8B5CF6] text-sm font-semibold text-white active:scale-[0.98]">Turn on alerts</button>
        </>
      )}
    </Fold>
  );
}

// ----------------------------------------------------------- theme
export function ThemeSection() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("andigital.theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <Fold title={<span className="flex items-center gap-2">{dark ? <Moon size={16} /> : <Sun size={16} />} Appearance</span>}>
      <button type="button" onClick={toggle} className="flex min-h-[44px] w-full items-center justify-between rounded-xl glass px-4 text-sm font-semibold text-[#2E1065]">
        {dark ? "Dark mode" : "Light mode"}
        <span className="text-xs text-[#6B5F8A]">Tap to switch</span>
      </button>
    </Fold>
  );
}

// ----------------------------------------------------------- CSV import
export function ImportSection() {
  const { categories, refreshAll, pushToast, user } = useTracker();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const onFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    setReport(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("The file has no data rows.");
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const dateI = col("date"), catI = col("category"), amtI = col("amount_php"), payI = col("payment_method"), noteI = col("note");
      if (dateI < 0 || catI < 0 || amtI < 0) throw new Error("Expected columns: date, category, amount_php (and optional payment_method, note).");

      const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const fallback = byName.get("miscellaneous") ?? categories[0]?.id;
      const payload: Record<string, unknown>[] = [];
      let skipped = 0;
      for (const r of rows.slice(1)) {
        const date = (r[dateI] ?? "").trim();
        const amount = cents(Number((r[amtI] ?? "").replace(/,/g, "")));
        const categoryId = byName.get((r[catI] ?? "").trim().toLowerCase()) ?? fallback;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(amount > 0) || !categoryId) {
          skipped++;
          continue;
        }
        const pm = (payI >= 0 ? r[payI] : "")?.trim();
        payload.push({
          user_id: user.id,
          category_id: categoryId,
          amount,
          spent_on: date,
          payment_method: (PAYMENT_METHODS as readonly string[]).includes(pm) ? pm : "Cash",
          note: (noteI >= 0 ? r[noteI] : "")?.slice(0, 200) ?? "",
        });
      }

      const sb = getSupabase();
      let inserted = 0;
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await sb.from("expenses").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      await refreshAll();
      setReport(`Imported ${inserted} expense${inserted === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} invalid row${skipped === 1 ? "" : "s"}` : ""}.`);
      pushToast("Import finished");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Fold title={<span className="flex items-center gap-2"><Upload size={16} /> Import expenses (CSV)</span>}>
      <p className="text-xs text-[#6B5F8A]">Use the same columns as the export: date (YYYY-MM-DD), category, amount_php, payment_method, note.</p>
      <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl glass text-sm font-semibold text-[#5B21B6] active:scale-[0.98]">
        {busy ? "Importing…" : "Choose CSV file"}
        <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {report && <p className="text-xs text-emerald-700">{report}</p>}
    </Fold>
  );
}

