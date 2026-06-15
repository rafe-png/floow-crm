"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { AdInvestment, NewAdInvestmentInput } from "@/lib/types";

export function useAdInvestments() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [investments, setInvestments] = useState<AdInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("ad_investments")
        .select("*")
        .order("periodo_inicio", { ascending: false });
      if (cancelled) return;
      setInvestments((data ?? []) as AdInvestment[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("ad-investments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_investments" },
        (payload) => {
          setInvestments((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as AdInvestment;
              // dedupe: o lançamento já pode ter entrado pela atualização otimista
              if (prev.some((i) => i.id === row.id)) return prev;
              return [row, ...prev].sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio));
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((i) => (i.id === (payload.new as AdInvestment).id ? (payload.new as AdInvestment) : i));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((i) => i.id !== (payload.old as AdInvestment).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const createInvestment = useCallback(
    async (input: NewAdInvestmentInput) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("ad_investments")
        .insert({
          periodo_inicio: input.periodo_inicio,
          periodo_fim: input.periodo_fim,
          valor: input.valor,
          leads_ads: input.leads_ads,
          canal: input.canal ?? null,
          created_by: userEmail,
        })
        .select()
        .single();
      if (error) throw error;
      // Atualização otimista: aparece na hora, sem depender do tempo real.
      const row = data as AdInvestment | null;
      if (row) {
        setInvestments((prev) =>
          prev.some((i) => i.id === row.id)
            ? prev
            : [row, ...prev].sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio)),
        );
      }
    },
    [userEmail],
  );

  const updateInvestment = useCallback(async (id: string, input: NewAdInvestmentInput) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ad_investments")
      .update({
        periodo_inicio: input.periodo_inicio,
        periodo_fim: input.periodo_fim,
        valor: input.valor,
        leads_ads: input.leads_ads,
        canal: input.canal ?? null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const row = data as AdInvestment | null;
    if (row) {
      setInvestments((prev) =>
        prev
          .map((i) => (i.id === row.id ? row : i))
          .sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio)),
      );
    }
  }, []);

  const deleteInvestment = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from("ad_investments").delete().eq("id", id);
    if (error) throw error;
    setInvestments((prev) => prev.filter((i) => i.id !== id)); // some na hora
  }, []);

  return { investments, loading, createInvestment, updateInvestment, deleteInvestment };
}
