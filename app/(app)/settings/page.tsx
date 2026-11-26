"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bell, Download, Lock, Plus, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { PickerField } from "@/components/PickerField";
import { Fold } from "@/components/Fold";
import { ImportSection, NotificationsSection, PinSection, RecurringSection, ThemeSection } from "@/components/SettingsExtras";
import { DuckMascot } from "@/components/DuckMascot";
import { useTracker } from "@/lib/tracker-context";
import { getSupabase } from "@/lib/supabase/client";
import { CATEGORY_ICON_KEYS, categoryIcon } from "@/lib/icons";
import { cents, monthLabel, peso } from "@/lib/format";
import { otherProfile, profileLabel } from "@/lib/profiles";
import type { AllowanceEntry, AllowanceKind, Category, LimitMode } from "@/lib/types";

export default function SettingsPage() {
  const { activeProfile, switchProfile, selectedMonth, currentMonth, allowances, pushToast } = useTracker();
  const base = allowances.find((a) => a.kind === "base");
  const [allowanceText, setAllowanceText] = useState("");
  const [topText, setTopText] = useState("");
  const [topNote, setTopNote] = useState("");
  const [topKind, setTopKind] = useState<Exclude<AllowanceKind, "base" | "savings_transfer">>("topup");

  useEffect(() => {
    setAllowanceText(base ? String(base.amount) : "");
  }, [base?.id, base?.amount, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const { setBaseAllowance, addAllowanceEntry } = useTracker();

  const saveBase = async () => {
    const n = cents(Number(allowanceText.replace(/,/g, "")));
    if (!Number.isFinite(n) || n < 0) return pushToast("Enter a valid amount", "error");
    await setBaseAllowance(n);
  };

  const addTop = async () => {
    const n = cents(Number(topText.replace(/,/g, "")));
    if (!(n > 0)) return pushToast("Enter a positive amount", "error");
    const ok = await addAllowanceEntry(n, topKind, topNote.trim());
    if (ok) {
      setTopText("");
      setTopNote("");
    }
  };

  const exportCsv = async () => {
    const sb = getSupabase();
    const [{ data: exp }, { data: cats }] = await Promise.all([
      sb.from("expenses").select("*").order("spent_on", { ascending: true }),
      sb.from("categories").select("id,name"),
    ]);
    const names = new Map((cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["date", "category", "amount_php", "payment_method", "note", "over_budget_override"].join(","),
      ...(exp ?? []).map((e: Record<string, unknown>) =>
        [e.spent_on, esc(names.get(e.category_id as string)), e.amount, esc(e.payment_method), esc(e.note), e.over_budget_override].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `andigital-expenses-${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-center gap-3 pt-2">
        <DuckMascot mood="idle" size={44} />
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-[#2E1065]">Settings</h1>
          <p className="truncate text-xs text-[#6B5F8A]">{profileLabel(activeProfile)}</p>
        </div>
      </header>

      {/* Allowance */}
      <Fold title={<span className="flex items-center gap-2"><DuckMascot mood="idle" size={28} />Allowance · {monthLabel(selectedMonth)}</span>}>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Starting amount</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-[#EDE9FE] bg-white/40 px-3 focus-within:border-[#8B5CF6]">
            <span className="text-xl font-bold text-[#8B5CF6]">₱</span>
            <input
              inputMode="decimal"
              value={allowanceText}
              onChange={(e) => setAllowanceText(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
              className="tabular h-12 w-full bg-transparent text-xl font-bold text-[#7C3AED] outline-none"
            />
          </div>
        </label>
        <button type="button" onClick={saveBase} className="min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] font-semibold text-white active:scale-[0.98]">
          {base ? "Update allowance" : "Set allowance"}
        </button>

        <div className="border-t border-[#EDE9FE] pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B5F8A]">Mid-month top-up / adjustment</p>
          <div className="grid grid-cols-5 gap-2">
            <input
              inputMode="decimal"
              value={topText}
              onChange={(e) => setTopText(e.target.value.replace(/[^0-9.,-]/g, ""))}
              placeholder="₱ amount"
              aria-label="Top-up amount"
              className="col-span-2 h-11 rounded-xl border border-[#EDE9FE] glass px-3 outline-none focus:border-[#8B5CF6]"
            />
            <div className="col-span-3">
              <PickerField
                title="Entry type"
                value={topKind}
                onChange={(v) => setTopKind(v)}
                options={[
                  { value: "topup", label: "Top-up (+)", Icon: Plus },
                  { value: "adjustment", label: "Adjustment (±)", Icon: SlidersHorizontal },
                ]}
              />
            </div>
            <input
              value={topNote}
              onChange={(e) => setTopNote(e.target.value)}
              placeholder="Note (optional)"
              aria-label="Top-up note"
              maxLength={120}
              className="col-span-5 h-11 rounded-xl border border-[#EDE9FE] glass px-3 outline-none focus:border-[#8B5CF6]"
            />
          </div>
          <button type="button" onClick={addTop} className="mt-2 min-h-[44px] w-full rounded-2xl bg-[#DDD6FE] font-semibold text-[#5B21B6] active:scale-[0.98]">
            Add to this month
          </button>
        </div>

        {allowances.length > 0 && (
          <ul className="space-y-1 border-t border-[#EDE9FE] pt-3 text-sm">
            {allowances.map((a: AllowanceEntry) => (
              <li key={a.id} className="flex items-center justify-between py-1">
                <span className="text-[#6B5F8A]">{labelFor(a.kind)}{a.note ? ` · ${a.note}` : ""}</span>
                <span className="tabular font-semibold text-[#2E1065]">{peso(Number(a.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </Fold>

      {/* Categories */}
      <CategoriesSection />

      <ThemeSection />
      <PinSection />
      <NotificationsSection />
      <RecurringSection />

      {/* Data & account */}
      <Fold title={<span className="flex items-center gap-2">Data & account</span>}>
        <button type="button" onClick={exportCsv} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[#DDD6FE] font-semibold text-[#5B21B6] active:bg-[#F5F3FF]">
          <Download size={18} /> Export all expenses (CSV)
        </button>
        <ImportSection />
        <button type="button" onClick={switchProfile} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2E1065] font-semibold text-white active:scale-[0.98]">
          <Users size={18} /> Switch to {profileLabel(otherProfile(activeProfile))}
        </button>
      </Fold>
    </div>
  );
}

function labelFor(kind: AllowanceKind) {
  switch (kind) {
    case "base":
      return "Starting amount";
    case "topup":
      return "Top-up";
    case "adjustment":
      return "Adjustment";
    case "savings_transfer":
      return "From savings";
  }
}

function CategoriesSection() {
  const { categories, saveCategory, deleteCategory, reorderCategories } = useTracker();
  const [newName, setNewName] = useState("");

  const move = (idx: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderCategories(ids);
  };

  return (
    <Fold title={<span className="flex items-center gap-2"><DuckMascot mood="idle" size={28} />Categories & limits</span>}>
      <p className="text-xs text-[#6B5F8A]">
        <strong>Warn only</strong> shows an amber/rose banner and still saves. <strong>Hard block</strong> stops saving over the limit unless you confirm an override.
      </p>

      <ul className="space-y-3">
        {categories.map((cat, idx) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            isFirst={idx === 0}
            isLast={idx === categories.length - 1}
            onMove={(d) => move(idx, d)}
            onSave={saveCategory}
            onDelete={(reassignTo) => deleteCategory(cat.id, reassignTo)}
            fallbackCategories={categories.filter((c) => c.id !== cat.id)}
          />
        ))}
      </ul>

      <form
        className="flex gap-2 border-t border-[#EDE9FE] pt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          const ok = await saveCategory({ name: newName, limit_mode: "soft_warn", monthly_limit: null });
          if (ok) setNewName("");
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
          maxLength={40}
          className="h-11 min-w-0 flex-1 rounded-xl border border-[#EDE9FE] glass px-3 outline-none focus:border-[#8B5CF6]"
        />
        <button type="submit" className="grid h-11 min-w-[44px] place-items-center rounded-xl bg-[#8B5CF6] px-3 font-semibold text-white active:scale-95" aria-label="Add category">
          <Plus size={18} />
        </button>
      </form>
    </Fold>
  );
}

function CategoryRow({
  category,
  isFirst,
  isLast,
  onMove,
  onSave,
  onDelete,
  fallbackCategories,
}: {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onSave: (input: Partial<Category> & { name: string }) => Promise<boolean>;
  onDelete: (reassignTo: string) => Promise<boolean>;
  fallbackCategories: Category[];
}) {
  const [name, setName] = useState(category.name);
  const [limit, setLimit] = useState(category.monthly_limit != null ? String(category.monthly_limit) : "");
  const [mode, setMode] = useState<LimitMode>(category.limit_mode);
  const [icon, setIcon] = useState(category.icon);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reassignTo, setReassignTo] = useState(fallbackCategories[0]?.id ?? "");
  const Icon = categoryIcon(icon);

  const dirty =
    name !== category.name ||
    (limit === "" ? null : cents(Number(limit))) !== category.monthly_limit ||
    mode !== category.limit_mode ||
    icon !== category.icon;

  const save = () =>
    onSave({
      id: category.id,
      name,
      icon,
      monthly_limit: limit === "" ? null : cents(Number(limit)),
      limit_mode: mode,
      color: category.color,
    });

  return (
    <li className="rounded-2xl border border-[#EDE9FE] bg-white/40 p-3">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl glass text-[#7C3AED] ring-1 ring-[#EDE9FE]">
          <Icon size={18} />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Name for ${category.name}`}
          maxLength={40}
          className="h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 font-semibold text-[#2E1065] outline-none focus:border-[#8B5CF6] focus:glass"
        />
        <button type="button" aria-label="Move up" disabled={isFirst} onClick={() => onMove(-1)} className="grid h-11 w-9 place-items-center text-[#7C3AED] disabled:opacity-30">
          <ArrowUp size={16} />
        </button>
        <button type="button" aria-label="Move down" disabled={isLast} onClick={() => onMove(1)} className="grid h-11 w-9 place-items-center text-[#7C3AED] disabled:opacity-30">
          <ArrowDown size={16} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-2">
        <label className="col-span-2">
          <span className="sr-only">Monthly limit</span>
          <div className="flex h-11 items-center rounded-xl border border-[#EDE9FE] glass px-2 focus-within:border-[#8B5CF6]">
            <span className="text-sm text-[#8B5CF6]">₱</span>
            <input
              inputMode="decimal"
              value={limit}
              placeholder="No cap"
              onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))}
              className="tabular w-full bg-transparent px-1 text-sm font-semibold outline-none"
            />
          </div>
        </label>
        <div className="col-span-2">
          <PickerField
            title="Limit mode"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "soft_warn", label: "Warn only", description: "Warns, still saves", Icon: Bell },
              { value: "hard_block", label: "Hard block", description: "Needs an override", Icon: Lock },
            ]}
          />
        </div>
        <div className="col-span-5">
          <PickerField
            title="Choose icon"
            variant="grid"
            value={icon}
            onChange={(v) => setIcon(v)}
            options={CATEGORY_ICON_KEYS.map((k) => ({ value: k, label: k, Icon: categoryIcon(k) }))}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {dirty && (
          <button type="button" onClick={save} className="min-h-[44px] flex-1 rounded-xl bg-[#8B5CF6] text-sm font-semibold text-white active:scale-[0.98]">
            Save
          </button>
        )}
        {confirmDel ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <PickerField
                title="Move expenses to"
                value={reassignTo}
                onChange={(v) => setReassignTo(v)}
                options={fallbackCategories.map((c) => ({ value: c.id, label: `Move to ${c.name}` }))}
              />
            </div>
            <button type="button" disabled={!reassignTo} onClick={() => onDelete(reassignTo)} className="min-h-[44px] rounded-xl bg-rose-500 px-3 text-sm font-semibold text-white disabled:opacity-40">
              Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${category.name}`}
            disabled={fallbackCategories.length === 0}
            onClick={() => setConfirmDel(true)}
            className="ml-auto grid h-11 w-11 place-items-center rounded-xl text-rose-500 active:bg-rose-50 disabled:opacity-30"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </li>
  );
}
