"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { AddExpenseSheet } from "@/components/AddExpenseSheet";
import { SavingsSheet } from "@/components/SavingsSheet";
import { DuckMascot } from "@/components/DuckMascot";
import { useTracker } from "@/lib/tracker-context";
import type { Expense } from "@/lib/types";

type SheetsState = {
  openExpense: (editing?: Expense | null) => void;
  openSavings: () => void;
  notifyLogged: () => void;
};

const SheetsContext = createContext<SheetsState | null>(null);

export function useSheets() {
  const ctx = useContext(SheetsContext);
  if (!ctx) throw new Error("useSheets must be used inside <AppShell>");
  return ctx;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { toasts, ready, user } = useTracker();
  const pathname = usePathname();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [loggedKey, setLoggedKey] = useState<number | null>(null);

  const openExpense = useCallback((e?: Expense | null) => {
    setEditing(e ?? null);
    setExpenseOpen(true);
  }, []);
  const openSavings = useCallback(() => setSavingsOpen(true), []);
  const notifyLogged = useCallback(() => {
    const key = Date.now();
    setLoggedKey(key);
    setTimeout(() => setLoggedKey((cur) => (cur === key ? null : cur)), 1600);
  }, []);

  const value = useMemo(
    () => ({ openExpense, openSavings, notifyLogged }),
    [openExpense, openSavings, notifyLogged],
  );

  return (
    <SheetsContext.Provider value={value}>
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-[#FAF8FF] shadow-xl">
        {/* Safe-area aware content area; bottom padding clears the nav bar */}
        <main
          className="flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
          style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
        >
          {ready && user ? children : <div className="grid min-h-[60dvh] place-items-center"><DuckMascot mood="idle" size={88} /></div>}
        </main>

        {user && <BottomNav pathname={pathname} onAdd={() => openExpense(null)} />}

        {/* Toasts */}
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto flex max-w-md flex-col items-center gap-2 px-4">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={`rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
                  t.tone === "error"
                    ? "bg-[#F43F5E] text-white"
                    : t.tone === "warn"
                      ? "bg-[#F59E0B] text-white"
                      : "bg-[#2E1065] text-white"
                }`}
              >
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Coin-sparkle duck confirmation after an expense is saved */}
        <AnimatePresence>
          {loggedKey !== null && <LoggedFlash key={loggedKey} />}
        </AnimatePresence>

        <AddExpenseSheet open={expenseOpen} editing={editing} onClose={() => setExpenseOpen(false)} />
        <SavingsSheet open={savingsOpen} onClose={() => setSavingsOpen(false)} />
      </div>
    </SheetsContext.Provider>
  );
}

function LoggedFlash() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed left-1/2 top-[30%] z-[70] -translate-x-1/2"
    >
      <motion.div
        className="rounded-3xl bg-white/90 p-3 shadow-xl ring-1 ring-[#EDE9FE]"
      >
        <DuckMascot mood="logged" size={96} title="Expense saved" />
        <p className="mt-1 text-center text-sm font-semibold text-[#7C3AED]">Saved! 🪙</p>
      </motion.div>
    </motion.div>
  );
}
