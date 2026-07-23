import { Link, NavLink } from "react-router-dom";
import { ArrowLeftRight, Receipt } from "lucide-react";
import { cn } from "@/lib/cn";
import { getClientNavItems } from "@/lib/navigation";
import { useCurrentClient } from "@/context/ClientContext";

export function Sidebar() {
  const { client } = useCurrentClient();
  const navItems = getClientNavItems(client.id);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Receipt className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
              {client.company_name}
            </p>
            <p className="text-xs text-slate-400">{client.gstin ?? "No GSTIN on file"}</p>
          </div>
        </div>
        <Link
          to="/"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Switch Client
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ label, path, icon: Icon, available }) => (
          <NavLink
            key={path}
            to={path}
            end={path === `/clients/${client.id}`}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900",
                !available && "opacity-60"
              )
            }
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {!available && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                Soon
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
