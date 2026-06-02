"use client";

import { createContext, useContext } from "react";
import { useTasksImpl } from "@/lib/hooks/useTasks";

type TasksContextValue = ReturnType<typeof useTasksImpl>;

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const value = useTasksImpl();
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasksContext(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksContext deve estar dentro de <TasksProvider>");
  return ctx;
}
