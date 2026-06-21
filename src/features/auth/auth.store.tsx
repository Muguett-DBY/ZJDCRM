import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SessionUser {
  id: string;
  account: string;
  displayName: string;
  isSuperAdmin: boolean;
  canManageSystem: boolean;
  departmentId: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  csrfToken: string;
  setSession: (user: SessionUser, csrfToken: string) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [csrfToken, setCsrfToken] = useState("");

  const setSession = useCallback((u: SessionUser, t: string) => {
    setUser(u);
    setCsrfToken(t);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setCsrfToken("");
  }, []);

  return (
    <AuthContext.Provider value={{ user, csrfToken, setSession, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
