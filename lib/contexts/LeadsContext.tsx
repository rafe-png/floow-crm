"use client";

import { createContext, useContext } from "react";
import { useLeads as useLeadsHook } from "@/lib/hooks/useLeads";

type LeadsContextValue = ReturnType<typeof useLeadsHook>;

const LeadsContext = createContext<LeadsContextValue | null>(null);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const value = useLeadsHook();
  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}

export function useLeadsContext(): LeadsContextValue {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error("useLeadsContext deve estar dentro de <LeadsProvider>");
  return ctx;
}
