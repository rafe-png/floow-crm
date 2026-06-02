"use client";

import { createContext, useContext } from "react";
import { useAllGoals as useAllGoalsHook } from "@/lib/hooks/useGoals";

type GoalsContextValue = ReturnType<typeof useAllGoalsHook>;

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const value = useAllGoalsHook();
  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoalsContext(): GoalsContextValue {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoalsContext deve estar dentro de <GoalsProvider>");
  return ctx;
}
