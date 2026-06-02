"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { NewTaskInput, Task } from "@/lib/types";

export function useTasksImpl() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("due_at", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      setTasks((data ?? []) as Task[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as Task;
              if (prev.some((t) => t.id === next.id)) return prev;
              return sortTasks([...prev, next]);
            }
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Task;
              return sortTasks(prev.map((t) => (t.id === next.id ? next : t)));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Task;
              return prev.filter((t) => t.id !== old.id);
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

  const createTask = useCallback(async (input: NewTaskInput, createdBy?: string | null) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        lead_id: input.lead_id ?? null,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        due_at: input.due_at ?? null,
        assignee: input.assignee ?? null,
        notify: input.notify ?? true,
        created_by: createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    const newTask = data as Task;
    // Otimista: adiciona já à lista (realtime dedup pelo id)
    setTasks((prev) => (prev.some((t) => t.id === newTask.id) ? prev : sortTasks([...prev, newTask])));
    return newTask;
  }, []);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    let snapshot: Task[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return sortTasks(prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    });
    const supabase = getSupabase();
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) {
      setTasks(snapshot);
      throw error;
    }
  }, []);

  const toggleDone = useCallback(async (id: string, done: boolean) => {
    let snapshot: Task[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return sortTasks(
        prev.map((t) =>
          t.id === id ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t,
        ),
      );
    });
    const supabase = getSupabase();
    const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
    if (error) {
      setTasks(snapshot);
      throw error;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    let snapshot: Task[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return prev.filter((t) => t.id !== id);
    });
    const supabase = getSupabase();
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      setTasks(snapshot);
      throw error;
    }
  }, []);

  return { tasks, loading, createTask, updateTask, toggleDone, deleteTask };
}

function sortTasks(arr: Task[]): Task[] {
  return [...arr].sort((a, b) => {
    // not-done first
    if (a.done !== b.done) return a.done ? 1 : -1;
    // then by due_at asc (nulls last)
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}
