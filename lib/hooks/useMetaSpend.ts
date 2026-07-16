"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { MetaAdSpendDay, MetaCreativeSpendDay } from "@/lib/types";

// Lê o gasto diário de anúncios (tabela meta_ad_spend_daily, preenchida pela
// sincronização com a Meta). Realtime: quando a sync grava, a UI atualiza sozinha.
// Expõe `sync()` pra disparar a sincronização manualmente (botão no Financeiro).
export function useMetaSpend() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [days, setDays] = useState<MetaAdSpendDay[]>([]);
  const [creativeDays, setCreativeDays] = useState<MetaCreativeSpendDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const [total, porCriativo] = await Promise.all([
        supabase.from("meta_ad_spend_daily").select("*").order("day", { ascending: false }),
        supabase.from("meta_creative_spend_daily").select("*").order("day", { ascending: false }),
      ]);
      if (cancelled) return;
      setDays((total.data ?? []) as MetaAdSpendDay[]);
      setCreativeDays((porCriativo.data ?? []) as MetaCreativeSpendDay[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("meta-ad-spend-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meta_ad_spend_daily" },
        (payload) => {
          setDays((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((d) => d.day !== (payload.old as MetaAdSpendDay).day);
            }
            const row = payload.new as MetaAdSpendDay;
            const rest = prev.filter((d) => d.day !== row.day);
            return [row, ...rest].sort((a, b) => b.day.localeCompare(a.day));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meta_creative_spend_daily" },
        (payload) => {
          setCreativeDays((prev) => {
            const key = (d: MetaCreativeSpendDay) => `${d.day}|${d.criativo_codigo}`;
            if (payload.eventType === "DELETE") {
              const old = payload.old as MetaCreativeSpendDay;
              return prev.filter((d) => key(d) !== key(old));
            }
            const row = payload.new as MetaCreativeSpendDay;
            const rest = prev.filter((d) => key(d) !== key(row));
            return [row, ...rest].sort((a, b) => b.day.localeCompare(a.day));
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Dispara a sincronização com a Meta (rota autoriza pela sessão de admin).
  // O resultado chega no state via realtime; retorna o resumo pra feedback.
  const sync = useCallback(async (windowDays = 90): Promise<{ ok: boolean; synced?: number; error?: string }> => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/meta/sync?days=${windowDays}`, { method: "GET" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const msg = json?.error || "Falha ao sincronizar com a Meta.";
        setSyncError(msg);
        return { ok: false, error: msg };
      }
      return { ok: true, synced: json.synced };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de rede ao sincronizar.";
      setSyncError(msg);
      return { ok: false, error: msg };
    } finally {
      setSyncing(false);
    }
  }, []);

  // Timestamp da sincronização mais recente (max updated_at).
  const lastSync = days.reduce<string | null>((acc, d) => (!acc || d.updated_at > acc ? d.updated_at : acc), null);

  return { days, creativeDays, loading, sync, syncing, syncError, lastSync };
}
