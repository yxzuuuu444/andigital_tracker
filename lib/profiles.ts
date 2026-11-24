// Two fixed profiles, each backed by its own Supabase anonymous account.
// Session tokens for both are kept in this browser's localStorage so switching is instant.

export type ProfileId = 1 | 2;

const ACTIVE_KEY = "andigital.activeProfile";
const SESSIONS_KEY = "andigital.profileSessions";

type StoredTokens = { access_token: string; refresh_token: string };
type StoredSessions = Partial<Record<`${ProfileId}`, StoredTokens>>;

export function profileLabel(p: ProfileId) {
  return `Profile ${p}`;
}

export function otherProfile(p: ProfileId): ProfileId {
  return p === 1 ? 2 : 1;
}

export function getActiveProfile(): ProfileId {
  try {
    return window.localStorage.getItem(ACTIVE_KEY) === "2" ? 2 : 1;
  } catch {
    return 1;
  }
}

export function setActiveProfile(p: ProfileId) {
  try {
    window.localStorage.setItem(ACTIVE_KEY, String(p));
  } catch {
    /* storage unavailable: profile still works for this page load */
  }
}

function readAll(): StoredSessions {
  try {
    return JSON.parse(window.localStorage.getItem(SESSIONS_KEY) || "{}") as StoredSessions;
  } catch {
    return {};
  }
}

export function readSession(p: ProfileId): StoredTokens | null {
  return readAll()[`${p}`] ?? null;
}

/** Save (or clear, with null) the tokens for one profile. */
export function writeSession(p: ProfileId, tokens: StoredTokens | null) {
  try {
    const all = readAll();
    if (tokens) all[`${p}`] = { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
    else delete all[`${p}`];
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  } catch {
    /* ignore: worst case the profile starts fresh next visit */
  }
}
