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
              return [payload.new as AdInvestment, ...prev].sort((a, b) =>
                b.periodo_inicio.localeCompare(a.periodo_inicio),
              );
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
      const { error } = await supabase.from("ad_investments").insert({
        periodo_inicio: input.periodo_inicio,
        periodo_fim: input.periodo_fim,
        valor: input.valor,
        leads_ads: input.leads_ads,
        canal: input.canal ?? null,
        created_by: userEmail,
      });
      if (error) throw error;
    },
    [userEmail],
  );

  const deleteInvestment = useCallback(async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from("ad_investments").delete().eq("id", id);
    if (error) throw error;
  }, []);

  return { investments, loading, createInvestment, deleteInvestment };
}
