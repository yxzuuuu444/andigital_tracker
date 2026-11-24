"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type {
  AllowanceEntry,
  AllowanceKind,
  Category,
  Expense,
  PaymentMethod,
  SavingsTx,
} from "@/lib/types";
import { cents, monthKey, monthRange, todayISO } from "@/lib/format";
import {
  getActiveProfile,
  otherProfile,
  profileLabel,
  readSession,
  setActiveProfile as persistActiveProfile,
  writeSession,
  type ProfileId,
} from "@/lib/profiles";

type Toast = { id: number; message: string; tone: "ok" | "error" | "warn" };

type TrackerState = {
  user: User | null;
  ready: boolean;
  currentMonth: string; // real current month, YYYY-MM
  selectedMonth: string; // month being viewed, YYYY-MM
  setSelectedMonth: (m: string) => void;
  categories: Category[];
  allowances: AllowanceEntry[]; // entries for selectedMonth
  expenses: Expense[]; // expenses for selectedMonth
  savings: SavingsTx[]; // full savings ledger
  savingsBalance: number;
  refreshAll: () => Promise<void>;
  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"]) => void;
  // Mutations (all optimistic where it matters)
  addExpense: (input: {
    category_id: string;
    amount: number;
    payment_method: PaymentMethod;
    note: string;
    spent_on: string;
    over_budget_override: boolean;
  }) => Promise<boolean>;
  updateExpense: (id: string, patch: Partial<Expense>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  setBaseAllowance: (amount: number) => Promise<boolean>;
  addAllowanceEntry: (amount: number, kind: Exclude<AllowanceKind, "base">, note: string) => Promise<boolean>;
  saveCategory: (input: Partial<Category> & { name: string }) => Promise<boolean>;
  deleteCategory: (id: string, reassignTo: string) => Promise<boolean>;
  reorderCategories: (orderedIds: string[]) => Promise<boolean>;
  addSavingsDeposit: (amount: number, note: string) => Promise<boolean>;
  withdrawSavings: (input: {
    amount: number;
    note: string;
    destination: "expense" | "allowance";
    category_id?: string;
    payment_method?: PaymentMethod;
  }) => Promise<boolean>;
  deleteSavingsTx: (id: string) => Promise<boolean>;
  activeProfile: ProfileId;
  switchProfile: () => Promise<void>;
};

const TrackerContext = createContext<TrackerState | null>(null);

function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [activeProfile, setActiveProfileState] = useState<ProfileId>(1);
  const currentMonth = monthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allowances, setAllowances] = useState<AllowanceEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [savings, setSavings] = useState<SavingsTx[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const pushToast = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ---- Loading ------------------------------------------------------------
  // uidRef = the account currently on screen. Responses for an account that is
  // no longer active (after a profile switch) are dropped.
  const uidRef = useRef<string | null>(null);
  const activeRef = useRef<ProfileId>(1);

  const loadMonthData = useCallback(async (month: string) => {
    const uid = uidRef.current;
    const sb = getSupabase();
    const { from, to } = monthRange(month);
    const [allow, exp] = await Promise.all([
      sb.from("monthly_allowances").select("*").eq("month", month).order("created_at"),
      sb
        .from("expenses")
        .select("*")
        .gte("spent_on", from)
        .lt("spent_on", to)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (allow.error) throw allow.error;
    if (exp.error) throw exp.error;
    if (uidRef.current !== uid) return;
    setAllowances((allow.data ?? []) as AllowanceEntry[]);
    setExpenses((exp.data ?? []) as Expense[]);
  }, []);

  const loadStatic = useCallback(async () => {
    const uid = uidRef.current;
    const sb = getSupabase();
    const [cats, sav] = await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("savings_transactions").select("*").order("created_at", { ascending: false }),
    ]);
    if (cats.error) throw cats.error;
    if (sav.error) throw sav.error;
    if (uidRef.current !== uid) return;
    setCategories((cats.data ?? []) as Category[]);
    setSavings((sav.data ?? []) as SavingsTx[]);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([loadStatic(), loadMonthData(selectedMonth)]);
    } catch (e) {
      pushToast(errMsg(e), "error");
    }
  }, [loadStatic, loadMonthData, selectedMonth, pushToast]);

  // ---- Profiles & session lifecycle ---------------------------------------
  const clearData = useCallback(() => {
    setCategories([]);
    setAllowances([]);
    setExpenses([]);
    setSavings([]);
  }, []);

  /** Loads everything for one account. Repeat calls for the same account are no-ops. */
  const handleUser = useCallback(
    async (u: User | null) => {
      if (!u) {
        uidRef.current = null;
        clearData();
        setUser(null);
        setReady(true);
        return;
      }
      if (uidRef.current === u.id) {
        setUser(u);
        return;
      }
      uidRef.current = u.id;
      clearData();
      setUser(u);
      try {
        // Closes any unclosed past month exactly once, crediting unspent to savings.
        const { data: closed, error } = await getSupabase().rpc("run_month_rollovers", {
          p_current_month: currentMonth,
        });
        if (error) throw error;
        if (closed && closed > 0) pushToast(`Closed ${closed} past month${closed > 1 ? "s" : ""} into savings 🦆`);
        await loadStatic();
      } catch (e) {
        pushToast(errMsg(e), "error");
      } finally {
        setReady(true);
      }
    },
    [clearData, currentMonth, loadStatic, pushToast],
  );

  /** Signs into a profile: restores its saved session, or creates a fresh anonymous account. */
  const establish = useCallback(
    async (profile: ProfileId): Promise<User> => {
      const sb = getSupabase();
      const stored = readSession(profile);
      if (stored) {
        const { data, error } = await sb.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        });
        if (!error && data.session && data.user) {
          writeSession(profile, data.session);
          return data.user;
        }
        writeSession(profile, null);
        pushToast(`${profileLabel(profile)}'s saved sign-in expired, so it started fresh`, "warn");
      }
      const { data, error } = await sb.auth.signInAnonymously();
      if (error || !data.user || !data.session) throw error ?? new Error("Could not start a profile");
      writeSession(profile, data.session);
      return data.user;
    },
    [pushToast],
  );

  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;
    const initial = getActiveProfile();
    activeRef.current = initial;
    setActiveProfileState(initial);

    // Keep the saved tokens current: Supabase rotates refresh tokens on every refresh.
    const { data: sub } = sb.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session && uidRef.current === session.user.id) writeSession(activeRef.current, session);
    });

    (async () => {
      try {
        const u = await establish(initial);
        if (!cancelled) await handleUser(u);
      } catch (e) {
        pushToast(errMsg(e), "error");
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchProfile = useCallback(async () => {
    const current = activeRef.current;
    const next = otherProfile(current);
    // Save the latest tokens for the profile we're leaving.
    const { data: cur } = await getSupabase().auth.getSession();
    if (cur.session) writeSession(current, cur.session);

    activeRef.current = next;
    setActiveProfileState(next);
    persistActiveProfile(next);
    setReady(false);
    try {
      const u = await establish(next);
      await handleUser(u);
      pushToast(`Switched to ${profileLabel(next)}`);
    } catch (e) {
      pushToast(errMsg(e), "error");
      setReady(true);
    }
  }, [establish, handleUser, pushToast]);

  useEffect(() => {
    if (!user) return;
    loadMonthData(selectedMonth).catch((e) => pushToast(errMsg(e), "error"));
  }, [user, selectedMonth, loadMonthData, pushToast]);

  // ---- Derived --------------------------------------------------------------
  const savingsBalance = useMemo(
    () =>
      cents(
        savings.reduce((sum, s) => sum + (s.kind === "withdrawal" ? -s.amount : s.amount), 0),
      ),
    [savings],
  );

  // ---- Mutations -----------------------------------------------------------
  const addExpense: TrackerState["addExpense"] = async (input) => {
    if (!user) return false;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Expense = {
      id: tempId,
      user_id: user.id,
      category_id: input.category_id,
      amount: input.amount,
      payment_method: input.payment_method,
      note: input.note,
      spent_on: input.spent_on,
      over_budget_override: input.over_budget_override,
      created_at: new Date().toISOString(),
    };
    if (input.spent_on.slice(0, 7) === selectedMonth) {
      setExpenses((list) => [optimistic, ...list]);
    }
    const { data, error } = await getSupabase()
      .from("expenses")
      .insert({
        user_id: user.id,
        category_id: input.category_id,
        amount: input.amount,
        payment_method: input.payment_method,
        note: input.note,
        spent_on: input.spent_on,
        over_budget_override: input.over_budget_override,
      })
      .select()
      .single();
    if (error) {
      setExpenses((list) => list.filter((e) => e.id !== tempId));
      pushToast(errMsg(error), "error");
      return false;
    }
    setExpenses((list) => list.map((e) => (e.id === tempId ? (data as Expense) : e)));
    return true;
  };

  const updateExpense: TrackerState["updateExpense"] = async (id, patch) => {
    const before = expenses.find((e) => e.id === id);
    if (!before) return false;
    setExpenses((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { id: _id, user_id: _u, created_at: _c, ...dbPatch } = patch;
    void _id; void _u; void _c;
    const { error } = await getSupabase().from("expenses").update(dbPatch).eq("id", id);
    if (error) {
      setExpenses((list) => list.map((e) => (e.id === id ? before : e)));
      pushToast(errMsg(error), "error");
      return false;
    }
    return true;
  };

  const deleteExpense: TrackerState["deleteExpense"] = async (id) => {
    const before = expenses;
    setExpenses((list) => list.filter((e) => e.id !== id));
    const { error } = await getSupabase().from("expenses").delete().eq("id", id);
    if (error) {
      setExpenses(before);
      pushToast(errMsg(error), "error");
      return false;
    }
    pushToast("Expense deleted");
    return true;
  };

  const setBaseAllowance: TrackerState["setBaseAllowance"] = async (amount) => {
    if (!user) return false;
    const sb = getSupabase();
    const existing = allowances.find((a) => a.kind === "base");
    if (existing) {
      const prev = allowances;
      setAllowances((list) => list.map((a) => (a.id === existing.id ? { ...a, amount } : a)));
      const { error } = await sb.from("monthly_allowances").update({ amount }).eq("id", existing.id);
      if (error) {
        setAllowances(prev);
        pushToast(errMsg(error), "error");
        return false;
      }
    } else {
      const { data, error } = await sb
        .from("monthly_allowances")
        .insert({ user_id: user.id, month: selectedMonth, amount, kind: "base" })
        .select()
        .single();
      if (error) {
        pushToast(errMsg(error), "error");
        return false;
      }
      setAllowances((list) => [...list, data as AllowanceEntry]);
    }
    pushToast("Allowance saved 🦆");
    return true;
  };

  const addAllowanceEntry: TrackerState["addAllowanceEntry"] = async (amount, kind, note) => {
    if (!user) return false;
    const { data, error } = await getSupabase()
      .from("monthly_allowances")
      .insert({ user_id: user.id, month: selectedMonth, amount, kind, note: note || null })
      .select()
      .single();
    if (error) {
      pushToast(errMsg(error), "error");
      return false;
    }
    setAllowances((list) => [...list, data as AllowanceEntry]);
    pushToast("Added to this month's allowance");
    return true;
  };

  const saveCategory: TrackerState["saveCategory"] = async (input) => {
    if (!user) return false;
    const sb = getSupabase();
    const payload = {
      name: input.name.trim(),
      icon: input.icon ?? "circle",
      color: input.color ?? "#8B5CF6",
      monthly_limit: input.monthly_limit ?? null,
      limit_mode: input.limit_mode ?? "soft_warn",
    };
    if (input.id) {
      const prev = categories;
      setCategories((list) => list.map((c) => (c.id === input.id ? { ...c, ...payload } : c)));
      const { error } = await sb.from("categories").update(payload).eq("id", input.id);
      if (error) {
        setCategories(prev);
        pushToast(errMsg(error), "error");
        return false;
      }
    } else {
      const sort_order = categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 1;
      const { data, error } = await sb
        .from("categories")
        .insert({ ...payload, user_id: user.id, sort_order })
        .select()
        .single();
      if (error) {
        pushToast(errMsg(error), "error");
        return false;
      }
      setCategories((list) => [...list, data as Category]);
    }
    pushToast("Category saved");
    return true;
  };

  const deleteCategory: TrackerState["deleteCategory"] = async (id, reassignTo) => {
    const sb = getSupabase();
    // Move existing expenses first (category_id is RESTRICT on delete).
    const { error: moveErr } = await sb.from("expenses").update({ category_id: reassignTo }).eq("category_id", id);
    if (moveErr) {
      pushToast(errMsg(moveErr), "error");
      return false;
    }
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) {
      pushToast(errMsg(error), "error");
      return false;
    }
    setCategories((list) => list.filter((c) => c.id !== id));
    setExpenses((list) => list.map((e) => (e.category_id === id ? { ...e, category_id: reassignTo } : e)));
    pushToast("Category deleted");
    return true;
  };

  const reorderCategories: TrackerState["reorderCategories"] = async (orderedIds) => {
    const prev = categories;
    setCategories((list) =>
      orderedIds
        .map((id, idx) => {
          const c = list.find((x) => x.id === id);
          return c ? { ...c, sort_order: idx + 1 } : null;
        })
        .filter((x): x is Category => x !== null),
    );
    const sb = getSupabase();
    const results = await Promise.all(
      orderedIds.map((id, idx) => sb.from("categories").update({ sort_order: idx + 1 }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setCategories(prev);
      pushToast(errMsg(failed.error), "error");
      return false;
    }
    return true;
  };

  const addSavingsDeposit: TrackerState["addSavingsDeposit"] = async (amount, note) => {
    if (!user) return false;
    const { data, error } = await getSupabase()
      .from("savings_transactions")
      .insert({ user_id: user.id, kind: "deposit", amount, note: note || "Manual deposit" })
      .select()
      .single();
    if (error) {
      pushToast(errMsg(error), "error");
      return false;
    }
    setSavings((list) => [data as SavingsTx, ...list]);
    pushToast("Saved to your pond 🦆");
    return true;
  };

  const withdrawSavings: TrackerState["withdrawSavings"] = async (input) => {
    const { error } = await getSupabase().rpc("withdraw_savings", {
      p_amount: input.amount,
      p_note: input.note,
      p_destination: input.destination,
      p_category_id: input.category_id ?? null,
      p_payment: input.payment_method ?? "Cash",
      p_current_month: currentMonth,
      p_spent_on: todayISO(),
    });
    if (error) {
      pushToast(errMsg(error), "error");
      return false;
    }
    await refreshAll();
    pushToast(input.destination === "expense" ? "Logged from savings" : "Moved to this month's allowance");
    return true;
  };

  const deleteSavingsTx: TrackerState["deleteSavingsTx"] = async (id) => {
    const prev = savings;
    setSavings((list) => list.filter((s) => s.id !== id));
    const { error } = await getSupabase().from("savings_transactions").delete().eq("id", id);
    if (error) {
      setSavings(prev);
      pushToast(errMsg(error), "error");
      return false;
    }
    return true;
  };

  const value: TrackerState = {
    user,
    ready,
    currentMonth,
    selectedMonth,
    setSelectedMonth,
    categories,
    allowances,
    expenses,
    savings,
    savingsBalance,
    refreshAll,
    toasts,
    pushToast,
    addExpense,
    updateExpense,
    deleteExpense,
    setBaseAllowance,
    addAllowanceEntry,
    saveCategory,
    deleteCategory,
    reorderCategories,
    addSavingsDeposit,
    withdrawSavings,
    deleteSavingsTx,
    activeProfile,
    switchProfile,
  };

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error("useTracker must be used inside <TrackerProvider>");
  return ctx;
}
