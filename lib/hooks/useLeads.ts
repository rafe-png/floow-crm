"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import { syncCreateEvent, syncDeleteEvent, syncUpdateEvent } from "@/lib/calendar-sync";
import type { Lead, LeadEvent, LeadStatus } from "@/lib/types";

export type NewLeadInput = Omit<
  Lead,
  | "id"
  | "created_at"
  | "updated_at"
  | "status"
  | "observacoes"
  | "motivo_desqualificacao"
  | "google_event_id"
  | "google_calendar_id"
  | "meet_link"
  | "motivo_perda"
  | "agendado_em"
  | "reuniao_realizada_em"
  | "ganho_em"
  | "criativo_codigo"
  | "origem"
>;

type UpdateLeadInput = Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;

export function useLeads() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    async function fetchLeads() {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) setError(error.message);
      else setLeads((data ?? []) as Lead[]);
      setLoading(false);
    }
    fetchLeads();

    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          setLeads((prev) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as Lead;
              if (prev.some((l) => l.id === next.id)) return prev;
              return [next, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Lead;
              return prev.map((l) => (l.id === next.id ? next : l));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Lead;
              return prev.filter((l) => l.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    // Reforço: ao voltar pra aba, refaz a busca (o websocket pode perder
    // eventos enquanto a aba fica em segundo plano).
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchLeads();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const createLead = useCallback(async (input: NewLeadInput & { status?: LeadStatus }) => {
    const supabase = getSupabase();
    const { status, ...rest } = input;
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...rest, status: status ?? "reuniao_agendada" })
      .select()
      .single();
    if (error) throw error;
    const lead = data as Lead;

    // Cria evento no Google Calendar se tiver data agendada
    if (lead.data_agendamento) {
      const evt = await syncCreateEvent(lead);
      if (evt) {
        await supabase
          .from("leads")
          .update({ google_event_id: evt.eventId, meet_link: evt.meetLink })
          .eq("id", lead.id);
        return { ...lead, google_event_id: evt.eventId, meet_link: evt.meetLink };
      }
    }
    return lead;
  }, []);

  const updateLead = useCallback(async (id: string, patch: UpdateLeadInput) => {
    // Mover para no-show OU em-agendamento limpa o agendamento: zera a data
    // (e, via lógica abaixo, deleta o evento do Google Calendar e limpa
    // google_event_id/meet_link, tirando da agenda).
    if (patch.status === "no_show" || patch.status === "em_agendamento") {
      patch = { ...patch, data_agendamento: null };
    }

    const supabase = getSupabase();
    let prevSnapshot: Lead[] = [];
    let prevLead: Lead | undefined;
    setLeads((prev) => {
      prevSnapshot = prev;
      prevLead = prev.find((l) => l.id === id);
      return prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
    });
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) {
      setLeads(prevSnapshot);
      throw error;
    }

    if (!prevLead) return;
    const updated = { ...prevLead, ...patch } as Lead;

    // Decide o que fazer no Google Calendar
    const dateChanged =
      "data_agendamento" in patch && patch.data_agendamento !== prevLead.data_agendamento;
    const contentChanged =
      "nome" in patch || "empresa" in patch || "observacoes" in patch;

    if (!dateChanged && !contentChanged) return;

    if (prevLead.google_event_id) {
      // Já existe evento
      if (updated.data_agendamento) {
        const r = await syncUpdateEvent(prevLead.google_event_id, updated);
        if (r?.meetLink && r.meetLink !== prevLead.meet_link) {
          await supabase.from("leads").update({ meet_link: r.meetLink }).eq("id", id);
        }
      } else {
        // Data foi removida → deleta evento
        await syncDeleteEvent(prevLead.google_event_id);
        await supabase
          .from("leads")
          .update({ google_event_id: null, meet_link: null })
          .eq("id", id);
      }
    } else if (updated.data_agendamento) {
      // Não tinha evento, agora tem data → cria
      const evt = await syncCreateEvent(updated);
      if (evt) {
        await supabase
          .from("leads")
          .update({ google_event_id: evt.eventId, meet_link: evt.meetLink })
          .eq("id", id);
      }
    }
  }, []);

  const moveLead = useCallback(
    async (id: string, newStatus: LeadStatus) => {
      await updateLead(id, { status: newStatus });
    },
    [updateLead],
  );

  const deleteLead = useCallback(async (id: string) => {
    const supabase = getSupabase();
    // Busca o lead pra ver se tem evento Google
    let leadToDelete: Lead | undefined;
    setLeads((prev) => {
      leadToDelete = prev.find((l) => l.id === id);
      return prev;
    });

    if (leadToDelete?.google_event_id) {
      await syncDeleteEvent(leadToDelete.google_event_id);
    }

    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;
  }, []);

  return { leads, loading, error, createLead, updateLead, moveLead, deleteLead };
}

export function useLeadEvents(leadId: string) {
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("lead_events")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setEvents((data ?? []) as LeadEvent[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`lead-events-${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_events", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setEvents((prev) => [payload.new as LeadEvent, ...prev]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  return { events, loading };
}

export function useAllLeadEvents() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("lead_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (cancelled) return;
      setEvents((data ?? []) as LeadEvent[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("lead-events-all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_events" },
        (payload) => {
          setEvents((prev) => [payload.new as LeadEvent, ...prev]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { events, loading };
}
