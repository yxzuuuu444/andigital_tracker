"use client";

import Link from "next/link";
import { History, Home, PiggyBank, Plus, Settings } from "lucide-react";
import { motion } from "framer-motion";

type Props = { pathname: string; onAdd: () => void };

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/history", label: "History", Icon: History },
] as const;

const tabsRight = [
  { href: "/savings", label: "Savings", Icon: PiggyBank },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function BottomNav({ pathname, onAdd }: Props) {
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const item = (href: string, label: string, Icon: typeof Home) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 text-[11px] font-medium transition-colors ${
          active ? "text-[#7C3AED]" : "text-[#9F94BD]"
        }`}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="relative flex items-center justify-between rounded-3xl border border-[#EDE9FE] glass-strong px-3 py-2 shadow-[0_-4px_24px_rgba(139,92,246,0.12)] backdrop-blur">
        <div className="flex flex-1 justify-around">{tabs.map((t) => item(t.href, t.label, t.Icon))}</div>

        {/* Center floating + */}
        <motion.button
          type="button"
          aria-label="Log an expense"
          onClick={onAdd}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className="mx-2 -mt-9 grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] text-white shadow-lg shadow-violet-400/50 ring-4 ring-[#FAF8FF]"
        >
          <Plus size={30} strokeWidth={2.6} />
        </motion.button>

        <div className="flex flex-1 justify-around">
          {tabsRight.map((t) => item(t.href, t.label, t.Icon))}
        </div>
      </div>
    </nav>
  );
}
