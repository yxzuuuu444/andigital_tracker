"use client";

import { useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";

export type PickerOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  Icon?: LucideIcon;
};

type Props<T extends string> = {
  title: string; // shown in the modal header
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  variant?: "list" | "grid"; // grid = icon tiles
  className?: string;
  ariaLabel?: string;
};

/** Replaces a native <select>: a glass button that opens a bottom-sheet modal to choose. */
export function PickerField<T extends string>({
  title,
  value,
  options,
  onChange,
  variant = "list",
  className = "",
  ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel ?? title}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl glass px-3 text-left text-sm font-medium text-[#2E1065] active:scale-[0.99] ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.Icon && <current.Icon size={16} className="shrink-0 text-[#7C3AED]" />}
          <span className="truncate">{current?.label ?? "Choose"}</span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-[#6B5F8A]" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <ul
          role="listbox"
          aria-label={title}
          className={variant === "grid" ? "grid grid-cols-3 gap-2 pb-2" : "space-y-2 pb-2"}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border transition active:scale-[0.97] ${
                    variant === "grid"
                      ? "min-h-[84px] flex-col justify-center px-2 py-3 text-center"
                      : "min-h-[52px] px-3 py-2.5 text-left"
                  } ${
                    active
                      ? "border-[#8B5CF6] bg-[#8B5CF6]/20 ring-2 ring-[#8B5CF6]/40"
                      : "glass border-white/60"
                  }`}
                >
                  {o.Icon && <o.Icon size={variant === "grid" ? 22 : 18} className="shrink-0 text-[#7C3AED]" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#2E1065]">{o.label}</span>
                    {o.description && <span className="block text-[11px] text-[#6B5F8A]">{o.description}</span>}
                  </span>
                  {variant === "list" && active && <Check size={18} className="shrink-0 text-[#7C3AED]" />}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
