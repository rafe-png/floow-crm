"use client";

import { useEffect } from "react";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import type { Task } from "@/lib/types";

const STORAGE_KEY = "floow:notified-tasks";
const CHECK_INTERVAL_MS = 30_000;
const WINDOW_AHEAD_MS = 60_000;

function loadNotifiedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-200)));
}

async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

function showNotification(task: Task) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const body = task.descricao || "Sua tarefa está na hora.";
  const n = new Notification(`📌 ${task.titulo}`, {
    body,
    icon: "/favicon.ico",
    tag: `floow-task-${task.id}`,
  });
  n.onclick = () => {
    window.focus();
    window.location.href = "/tarefas";
    n.close();
  };
}

/**
 * Componente invisível que monitora tarefas e dispara notificações do browser
 * quando o due_at chega.
 */
export function TaskNotifier() {
  const { tasks } = useTasksContext();

  // Solicita permissão na montagem (uma vez)
  useEffect(() => {
    ensurePermission();
  }, []);

  useEffect(() => {
    const check = () => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      const now = Date.now();
      const notified = loadNotifiedIds();
      let changed = false;
      for (const t of tasks) {
        if (t.done || !t.notify || !t.due_at) continue;
        if (notified.has(t.id)) continue;
        const due = new Date(t.due_at).getTime();
        // Notifica se o due está dentro da próxima janela OU já passou (atrasada nunca notificada)
        if (due <= now + WINDOW_AHEAD_MS) {
          showNotification(t);
          notified.add(t.id);
          changed = true;
        }
      }
      if (changed) saveNotifiedIds(notified);
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tasks]);

  return null;
}
