import { useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { getClientNavItems } from "@/lib/navigation";
import { useCurrentClient } from "@/context/ClientContext";

export function TopBar() {
  const { client } = useCurrentClient();
  const location = useLocation();
  const current = getClientNavItems(client.id).find((item) => item.path === location.pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
      <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {current?.label ?? client.company_name}
      </h1>
      <ThemeToggle />
    </header>
  );
}
