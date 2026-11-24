"use client";

import { motion, type Transition, type TargetAndTransition } from "framer-motion";

export type DuckMood =
  | "idle" // header / logo: gentle bob
  | "empty" // no expenses yet: waddle + head tilt
  | "logged" // expense saved: hop + coin sparkle (play once)
  | "relaxed" // healthy budget / savings: floating on coin stack
  | "panic"; // over budget: shaking with a sweat drop

export type DuckVariant = "lilac" | "rubber";

const SRC: Record<DuckVariant, string> = {
  lilac: "/icons/duck.png", // white duck with orange beak
  rubber: "/icons/duck-rubber.png", // yellow rubber duck
};

type Props = {
  mood?: DuckMood;
  variant?: DuckVariant;
  size?: number;
  className?: string;
  title?: string;
};

// Whole-duck transforms per mood. Transforms only, so it stays at 60fps on phones.
// Squash-and-stretch keeps it feeling alive, like a cartoon.
const bodyAnim: Record<DuckMood, TargetAndTransition> = {
  idle: { y: [0, -4, 0], scaleX: [1, 1.03, 1], scaleY: [1, 0.97, 1] },
  empty: { x: [-4, 4, -4], rotate: [-7, 7, -7], y: [0, -1, 0] },
  logged: { y: [0, -22, 0, -8, 0], scaleX: [1, 0.94, 1.06, 0.98, 1], scaleY: [1, 1.08, 0.92, 1.02, 1] },
  relaxed: { y: [0, -6, 0], rotate: [0, -3, 0], scaleY: [1, 1.02, 1] },
  panic: { x: [0, -2, 2, -2, 0], rotate: [0, -4, 4, 0] },
};

const bodyTransition: Record<DuckMood, Transition> = {
  idle: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
  empty: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
  logged: { duration: 0.7, ease: "easeOut" },
  relaxed: { duration: 3.4, repeat: Infinity, ease: "easeInOut" },
  panic: { duration: 0.25, repeat: Infinity, ease: "linear" },
};

const COIN = "#F59E0B";

export function DuckMascot({ mood = "idle", variant = "lilac", size = 64, className, title = "Duck mascot" }: Props) {
  return (
    <div
      role="img"
      aria-label={title}
      className={`relative shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {/* Coin stack the duck relaxes on */}
      {mood === "relaxed" && (
        <motion.svg
          viewBox="0 0 120 40"
          className="absolute inset-x-0 bottom-0 w-full"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          aria-hidden
        >
          <ellipse cx="60" cy="34" rx="46" ry="6" fill={COIN} opacity="0.35" />
          <ellipse cx="60" cy="28" rx="38" ry="5.5" fill={COIN} opacity="0.6" />
          <ellipse cx="60" cy="22" rx="30" ry="5" fill={COIN} />
          <ellipse cx="60" cy="16" rx="22" ry="4" fill="#FCD34D" />
        </motion.svg>
      )}

      {/* Ground shadow that shrinks as the duck bounces up */}
      <motion.div
        aria-hidden
        className="absolute bottom-[4%] left-1/2 h-[10%] w-[52%] -translate-x-1/2 rounded-[50%] bg-[#2E1065]/15 blur-[2px]"
        animate={
          mood === "logged"
            ? { scaleX: [1, 0.6, 1, 0.8, 1], opacity: [0.6, 0.3, 0.6, 0.4, 0.6] }
            : { scaleX: [1, 0.85, 1], opacity: [0.6, 0.4, 0.6] }
        }
        transition={mood === "logged" ? { duration: 0.7, ease: "easeOut" } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.img
        src={SRC[variant]}
        alt=""
        draggable={false}
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full select-none object-contain"
        style={{ transformOrigin: "50% 100%" }}
        animate={bodyAnim[mood]}
        transition={bodyTransition[mood]}
      />

      {/* Sweat drop when panicking */}
      {mood === "panic" && (
        <motion.svg
          viewBox="0 0 24 24"
          className="absolute right-[6%] top-[12%] w-[18%]"
          aria-hidden
          initial={{ opacity: 1, y: 0 }}
          animate={{ y: [0, 10], opacity: [1, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeIn" }}
        >
          <path d="M12 2 C 15 7, 18 10, 18 14 A 6 6 0 0 1 6 14 C 6 10, 9 7, 12 2 Z" fill="#7DD3FC" stroke="#0EA5E9" strokeWidth="1" />
        </motion.svg>
      )}

      {/* Heart + coin burst on a logged expense */}
      {mood === "logged" && (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {[
            { x: 50, y: 6, d: 0.05 },
            { x: 92, y: 40, d: 0.15 },
          ].map((h, i) => (
            <motion.path
              key={`h${i}`}
              d={`M${h.x} ${h.y + 4} C ${h.x - 6} ${h.y - 2}, ${h.x - 4} ${h.y - 8}, ${h.x} ${h.y - 3} C ${h.x + 4} ${h.y - 8}, ${h.x + 6} ${h.y - 2}, ${h.x} ${h.y + 4} Z`}
              fill="#F472B6"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.2, 0.8], y: [0, -6] }}
              transition={{ duration: 0.9, delay: h.d, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
          {[
            { x: 14, y: 22, d: 0 },
            { x: 86, y: 16, d: 0.12 },
            { x: 90, y: 78, d: 0.24 },
          ].map((s, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 1, 0], scale: [0.2, 1.1, 0.6] }}
              transition={{ duration: 0.8, delay: s.d, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <circle cx={s.x} cy={s.y} r="6" fill={COIN} stroke="#B45309" strokeWidth="1.5" />
              <path d={`M${s.x} ${s.y - 3.5} L${s.x + 1.2} ${s.y} L${s.x} ${s.y + 3.5} L${s.x - 1.2} ${s.y} Z`} fill="#FFFFFF" />
            </motion.g>
          ))}
        </svg>
      )}
    </div>
  );
}
