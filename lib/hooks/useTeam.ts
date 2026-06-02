"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { Owner, TeamMember } from "@/lib/types";

export function useTeamMembers() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (cancelled) return;
      setMembers((data ?? []) as TeamMember[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("team-members-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members" },
        (payload) => {
          setMembers((prev) => {
            if (payload.eventType === "INSERT") {
              return [...prev, payload.new as TeamMember].sort((a, b) =>
                a.name.localeCompare(b.name),
              );
            }
            if (payload.eventType === "UPDATE") {
              const m = payload.new as TeamMember;
              // Membro desativado some da lista (a query inicial filtra active=true)
              if (!m.active) return prev.filter((x) => x.id !== m.id);
              return prev.map((x) => (x.id === m.id ? m : x));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as TeamMember).id);
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

  const addMember = useCallback(async (name: string, role: Owner) => {
    await getSupabase().from("team_members").insert({ name: name.trim(), role });
  }, []);

  const deactivateMember = useCallback(async (id: string) => {
    await getSupabase().from("team_members").update({ active: false }).eq("id", id);
  }, []);

  return { members, loading, addMember, deactivateMember };
}
