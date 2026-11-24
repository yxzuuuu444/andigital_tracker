"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Slide-up drawer rendered inside the 448px app column so it matches the phone frame. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  // Portal to <body>: glass parents use backdrop-filter, which would otherwise
  // trap this fixed sheet inside them and break its position and scrolling.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-md items-end">
          <motion.div
            className="absolute inset-0 bg-[#2E1065]/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] glass-strong pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="sticky top-0 z-10 rounded-t-[28px] glass-strong px-5 pb-2 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#DDD6FE]" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#2E1065]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-11 w-11 place-items-center rounded-full text-[#6B5F8A] hover:bg-purple-50"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="px-5">{children}</div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
