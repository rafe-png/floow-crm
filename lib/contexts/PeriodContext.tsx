"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_PERIOD, type PeriodSelection } from "@/lib/reports";

type ContextValue = {
  period: PeriodSelection;
  setPeriod: (p: PeriodSelection) => void;
};

const PeriodContext = createContext<ContextValue | null>(null);

const STORAGE_KEY = "floow.period";

// Período selecionado, compartilhado por todas as telas (Dashboard, Financeiro,
// Relatórios). Persiste no localStorage pra sobreviver à navegação/refresh.
export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriodState] = useState<PeriodSelection>(DEFAULT_PERIOD);

  // Carrega a última seleção salva (só no client, depois do mount).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Carregar do storage depois do mount é intencional (evita mismatch de hidratação).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setPeriodState(JSON.parse(raw) as PeriodSelection);
    } catch {
      /* ignora storage indisponível/corrompido */
    }
  }, []);

  function setPeriod(p: PeriodSelection) {
    setPeriodState(p);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignora */
    }
  }

  return <PeriodContext.Provider value={{ period, setPeriod }}>{children}</PeriodContext.Provider>;
}

export function usePeriodContext(): ContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriodContext deve estar dentro de <PeriodProvider>");
  return ctx;
}
