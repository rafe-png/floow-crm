"use client";

import { usePathname } from "next/navigation";
import { AdInvestmentsProvider } from "@/lib/contexts/AdInvestmentsContext";
import { GoalsProvider } from "@/lib/contexts/GoalsContext";
import { LeadsProvider } from "@/lib/contexts/LeadsContext";
import { TasksProvider } from "@/lib/contexts/TasksContext";
import { TeamProvider } from "@/lib/contexts/TeamContext";
import { TaskNotifier } from "@/components/tasks/TaskNotifier";
import { MobileBottomNav, Sidebar } from "./Sidebar";

const NO_CHROME_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noChrome = NO_CHROME_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (noChrome) {
    return <>{children}</>;
  }

  return (
    <LeadsProvider>
      <GoalsProvider>
        <TeamProvider>
          <TasksProvider>
            <AdInvestmentsProvider>
              <Sidebar />
              <div className="flex h-screen flex-col md:pl-16 pb-16 md:pb-0">
                {children}
              </div>
              <MobileBottomNav />
              <TaskNotifier />
            </AdInvestmentsProvider>
          </TasksProvider>
        </TeamProvider>
      </GoalsProvider>
    </LeadsProvider>
  );
}
