import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { badgeService } from "@/services/badgeService";

const WorkBadgeContext = createContext<Record<string, number>>({});

export function WorkBadgeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const userId = user?.id;
  const role = user?.role;

  const load = useCallback(async () => {
    if (!isAuthenticated || !userId || role === "SUPERADMIN") {
      setCounts({});
      return;
    }
    try {
      const data = await badgeService.get();
      setCounts(data.counts || {});
    } catch {
      // Le dernier compteur reste affiché si le réseau coupe.
    }
  }, [isAuthenticated, userId, role]);

  useEffect(() => {
    void load();
  }, [load, location.pathname]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("badges:refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      window.removeEventListener("badges:refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.clearInterval(timer);
    };
  }, [load]);

  return <WorkBadgeContext.Provider value={counts}>{children}</WorkBadgeContext.Provider>;
}

export function useWorkBadges() {
  return useContext(WorkBadgeContext);
}

export function useAckExamResults(ids: string[]) {
  const key = ids.filter(Boolean).slice().sort().join(",");
  useEffect(() => {
    if (!key) return;
    void badgeService.seen(key.split(",")).catch(() => undefined);
  }, [key]);
}
