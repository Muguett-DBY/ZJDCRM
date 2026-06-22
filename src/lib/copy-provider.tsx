import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UI_COPY_DEFAULTS } from "../../shared/ui-copy";
import { api } from "./api";

type CopyContextValue = {
  t: (key: string, fallback?: string) => string;
  reload: () => Promise<void>;
};

const CopyContext = createContext<CopyContextValue | null>(null);

export function CopyProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try { setOverrides(await api.get<Record<string, string>>("/content/public")); } catch { /* retain defaults */ }
  }, []);

  useEffect(() => {
    let active = true;
    api.get<Record<string, string>>("/content/public")
      .then((value) => { if (active) setOverrides(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const value = useMemo<CopyContextValue>(() => ({
    t: (key, fallback) => overrides[key] || fallback || UI_COPY_DEFAULTS[key] || key,
    reload,
  }), [overrides, reload]);

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

export function useCopy(): CopyContextValue {
  const context = useContext(CopyContext);
  if (!context) throw new Error("useCopy must be used within CopyProvider");
  return context;
}
