"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { TeamMember } from "@/lib/types";

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
              return prev.map((m) =>
                m.id === (payload.new as TeamMember).id ? (payload.new as TeamMember) : m,
              );
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

  return { members, loading };
}
