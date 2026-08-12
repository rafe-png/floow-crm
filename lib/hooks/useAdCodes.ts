"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type AdCode = { id: string; code: string; label: string | null; active: boolean };

/** Códigos de anúncio ATIVOS (cadastrados em Configurações). Atualiza via realtime. */
export function useAdCodes(): AdCode[] {
  const [codes, setCodes] = useState<AdCode[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await getSupabase()
        .from("ad_codes")
        .select("id, code, label, active")
        .eq("active", true)
        .order("code");
      if (alive) setCodes((data as AdCode[]) ?? []);
    };
    load();
    const ch = getSupabase()
      .channel("ad_codes-pick")
      .on("postgres_changes", { event: "*", schema: "public", table: "ad_codes" }, () => load())
      .subscribe();
    return () => { alive = false; getSupabase().removeChannel(ch); };
  }, []);

  return codes;
}

// Dado um código (texto), devolve o par pro banco: txt sempre; int se for numérico.
export function codeToLeadFields(code: string | null): { criativo_codigo: number | null; criativo_codigo_txt: string | null } {
  const c = (code ?? "").trim();
  if (!c) return { criativo_codigo: null, criativo_codigo_txt: null };
  return { criativo_codigo: /^\d+$/.test(c) ? parseInt(c, 10) : null, criativo_codigo_txt: c };
}
