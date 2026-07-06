"use client";

import { createContext, useContext } from "react";
import { useMetaSpend } from "@/lib/hooks/useMetaSpend";

type ContextValue = ReturnType<typeof useMetaSpend>;

const MetaSpendContext = createContext<ContextValue | null>(null);

export function MetaSpendProvider({ children }: { children: React.ReactNode }) {
  const value = useMetaSpend();
  return <MetaSpendContext.Provider value={value}>{children}</MetaSpendContext.Provider>;
}

export function useMetaSpendContext(): ContextValue {
  const ctx = useContext(MetaSpendContext);
  if (!ctx) throw new Error("useMetaSpendContext deve estar dentro de <MetaSpendProvider>");
  return ctx;
}
