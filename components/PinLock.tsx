"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { DuckMascot } from "@/components/DuckMascot";
import { checkPin, unlock } from "@/lib/pin";
import { profileLabel, type ProfileId } from "@/lib/profiles";

type Props = { profile: ProfileId; onUnlock: () => void };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

/** Full-screen glass keypad shown when the active profile has a PIN and isn't unlocked. */
export function PinLock({ profile, onUnlock }: Props) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);

  const press = async (k: string) => {
    if (k === "back") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (!k || digits.length >= 4) return;
    const next = digits + k;
    setDigits(next);
    if (next.length === 4) {
      if (await checkPin(profile, next)) {
        unlock(profile);
        onUnlock();
      } else {
        setWrong(true);
        setTimeout(() => {
          setWrong(false);
          setDigits("");
        }, 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-md flex-col items-center justify-center gap-6 bg-[#2E1065]/25 p-6 backdrop-blur-xl">
      <DuckMascot mood="idle" size={88} />
      <div className="text-center">
        <p className="text-lg font-bold text-[#2E1065]">{profileLabel(profile)} is locked</p>
        <p className="text-xs text-[#4C1D95]">Enter your 4-digit PIN</p>
      </div>

      <motion.div
        className="flex gap-3"
        animate={wrong ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full ring-2 ring-white/70 ${i < digits.length ? (wrong ? "bg-rose-500" : "bg-[#7C3AED]") : "bg-white/40"}`}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              aria-label={k === "back" ? "Delete digit" : `Digit ${k}`}
              className="grid h-16 w-16 place-items-center rounded-full glass text-2xl font-semibold text-[#2E1065] active:scale-90"
            >
              {k === "back" ? <Delete size={22} /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
