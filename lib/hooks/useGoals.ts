"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { Owner, UserGoals } from "@/lib/types";

export function useAllGoals() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [goals, setGoals] = useState<Partial<Record<Owner, UserGoals>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase.from("user_goals").select("*");
      if (cancelled) return;
      const map: Partial<Record<Owner, UserGoals>> = {};
      for (const row of (data ?? []) as UserGoals[]) {
        map[row.owner] = row;
      }
      setGoals(map);
      setLoading(false);
    })();

    const channel = supabase
      .channel("user-goals-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_goals" },
        (payload) => {
          const row = (payload.new ?? payload.old) as UserGoals;
          setGoals((prev) => ({ ...prev, [row.owner]: payload.new as UserGoals }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const updateGoals = useCallback(async (owner: Owner, daily: number, weekly: number) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("user_goals")
      .update({ daily_goal: daily, weekly_goal: weekly, updated_at: new Date().toISOString() })
      .eq("owner", owner);
    if (error) throw error;
  }, []);

  return { goals, loading, updateGoals };
}
