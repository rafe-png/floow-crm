"use client";

import { createContext, useContext } from "react";
import { useAdInvestments } from "@/lib/hooks/useAdInvestments";

type ContextValue = ReturnType<typeof useAdInvestments>;

const AdInvestmentsContext = createContext<ContextValue | null>(null);

export function AdInvestmentsProvider({ children }: { children: React.ReactNode }) {
  const value = useAdInvestments();
  return <AdInvestmentsContext.Provider value={value}>{children}</AdInvestmentsContext.Provider>;
}

export function useAdInvestmentsContext(): ContextValue {
  const ctx = useContext(AdInvestmentsContext);
  if (!ctx) throw new Error("useAdInvestmentsContext deve estar dentro de <AdInvestmentsProvider>");
  return ctx;
}
