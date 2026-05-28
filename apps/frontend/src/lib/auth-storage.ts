// Lightweight client-side token store. We keep tokens in localStorage for the
// MVP; a future iteration may move to httpOnly cookies once the backend issues
// them. The store is intentionally tiny so it can be swapped without touching
// the rest of the app.

import type { AuthTokens, User } from "@/types";

const ACCESS_TOKEN_KEY = "unieats.accessToken";
const REFRESH_TOKEN_KEY = "unieats.refreshToken";
const USER_KEY = "unieats.user";
const AUTH_CHANGE_EVENT = "unieats.auth-change";
const AUTH_STORAGE_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY];

function isBrowser() {
  return typeof window !== "undefined";
}

function notifyAuthChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export const authStorage = {
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser(): User | null {
    if (!isBrowser()) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  setTokens(tokens: AuthTokens) {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  setUser(user: Pick<User, "id" | "email" | "nickname" | "role" | "isEmailVerified">) {
    if (!isBrowser()) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    notifyAuthChange();
  },

  clear() {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    notifyAuthChange();
  },

  subscribe(listener: () => void) {
    if (!isBrowser()) return () => {};

    const handleAuthChange = () => listener();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || AUTH_STORAGE_KEYS.includes(event.key)) {
        listener();
      }
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleStorage);
    };
  },
};
