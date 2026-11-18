"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import {
  loginAccount,
  logoutAccount,
  refreshSession,
  registerAccount,
  type AuthUser,
  type Credentials,
} from "./auth-api";

const SESSION_KEY = ["auth", "session"] as const;

export type AuthStatus = "loading" | "ready";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (credentials: Credentials) => Promise<AuthUser>;
  register: (credentials: Credentials) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Writes a user returned by another endpoint into the session cache. */
  syncUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state for the whole app. The first query spends the refresh cookie
 * once on page load; login, register, and logout update the cached value
 * directly instead of triggering another round trip.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: refreshSession,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  async function login(credentials: Credentials): Promise<AuthUser> {
    const user = await loginAccount(credentials);
    queryClient.setQueryData(SESSION_KEY, user);
    return user;
  }

  async function register(credentials: Credentials): Promise<AuthUser> {
    const user = await registerAccount(credentials);
    queryClient.setQueryData(SESSION_KEY, user);
    return user;
  }

  async function logout(): Promise<void> {
    await logoutAccount();
    // Keep the cached entry at `null` instead of removing it: removing an
    // observed query makes it refetch, which would spend a refresh request
    // just to learn there is no session.
    queryClient.setQueryData(SESSION_KEY, null);
  }

  function syncUser(user: AuthUser): void {
    queryClient.setQueryData(SESSION_KEY, user);
  }

  return (
    <AuthContext.Provider
      value={{
        user: session.data ?? null,
        // An unreachable API also ends in "ready" with no user: the rest of
        // the app stays usable, and the API status card explains the outage.
        status: session.isPending ? "loading" : "ready",
        login,
        register,
        logout,
        syncUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
