// Optional 4-digit PIN per profile. This is a privacy gate on a shared device, not
// real security: the data is still reachable with the anon key. The PIN is stored
// as a salted SHA-256 hash in this browser only.
import type { ProfileId } from "@/lib/profiles";

type Stored = { salt: string; hash: string };

const pinKey = (p: ProfileId) => `andigital.pin.${p}`;
const unlockKey = (p: ProfileId) => `andigital.unlocked.${p}`;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hash(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

export function hasPin(p: ProfileId) {
  try {
    return !!window.localStorage.getItem(pinKey(p));
  } catch {
    return false;
  }
}

export async function setPin(p: ProfileId, pin: string) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const stored: Stored = { salt, hash: await hash(pin, salt) };
  window.localStorage.setItem(pinKey(p), JSON.stringify(stored));
  unlock(p);
}

export async function checkPin(p: ProfileId, pin: string) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(pinKey(p)) || "null") as Stored | null;
    if (!stored) return true;
    return (await hash(pin, stored.salt)) === stored.hash;
  } catch {
    return false;
  }
}

export function clearPin(p: ProfileId) {
  window.localStorage.removeItem(pinKey(p));
  window.sessionStorage.removeItem(unlockKey(p));
}

export function isUnlocked(p: ProfileId) {
  try {
    return window.sessionStorage.getItem(unlockKey(p)) === "1";
  } catch {
    return false;
  }
}

export function unlock(p: ProfileId) {
  try {
    window.sessionStorage.setItem(unlockKey(p), "1");
  } catch {
    /* ignore */
  }
}

export function lock(p: ProfileId) {
  try {
    window.sessionStorage.removeItem(unlockKey(p));
  } catch {
    /* ignore */
  }
}
