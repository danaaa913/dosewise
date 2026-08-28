import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, type Pharmacy } from "@/lib/api";

interface AuthState {
  loading: boolean;
  loggedIn: boolean;
  isAdmin: boolean;
  pharmacy: Pharmacy | null;
}

interface AuthContextValue extends AuthState {
  isOperational: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  loggedIn: false,
  isAdmin: false,
  pharmacy: null,
  isOperational: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    loggedIn: false,
    isAdmin: false,
    pharmacy: null,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api.auth.check();
      setState({
        loading: false,
        loggedIn: data.loggedIn,
        isAdmin: data.isAdmin,
        pharmacy: data.pharmacy ?? null,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setState({ loading: false, loggedIn: false, isAdmin: false, pharmacy: null });
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const isOperational = Boolean(
    state.loggedIn &&
      !state.isAdmin &&
      state.pharmacy &&
      state.pharmacy.verificationStatus === "approved" &&
      state.pharmacy.isActive
  );

  return (
    <AuthContext.Provider value={{ ...state, isOperational, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
