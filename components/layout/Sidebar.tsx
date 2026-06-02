"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Calendar, CheckSquare, LayoutDashboard, Kanban, Settings } from "lucide-react";
import { FloowLogo } from "@/components/icons/FloowLogo";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const items: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Funis de vendas", icon: Kanban },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

const bottomItems: NavItem[] = [
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="group hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-16 hover:w-56 transition-[width] duration-200 bg-black border-r border-zinc-900 flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-zinc-900 px-5 overflow-hidden">
        <FloowLogo size={26} className="text-[#f5c518] shrink-0" />
        <span className="text-base font-semibold text-zinc-100 tracking-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          floow
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 mt-2">
        {items.map((it) => (
          <NavLink key={it.href} item={it} pathname={pathname} />
        ))}
      </nav>

      {/* Bottom items */}
      <nav className="mt-auto flex flex-col gap-1 p-2 border-t border-zinc-900">
        {bottomItems.map((it) => (
          <NavLink key={it.href} item={it} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors overflow-hidden ${
        active
          ? "bg-[#f5c518]/10 text-[#f5c518]"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
      <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {item.label}
      </span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t border-zinc-900 bg-black">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] ${
              active ? "text-[#f5c518]" : "text-zinc-400"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
