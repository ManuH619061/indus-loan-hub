import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import { useCurrentClient } from "@/context/ClientContext";
import { getClientNavItems } from "@/lib/navigation";

export function PlaceholderPage() {
  const { client } = useCurrentClient();
  const location = useLocation();
  const current = getClientNavItems(client.id).find((item) => item.path === location.pathname);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Construction className="h-7 w-7" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{current?.label ?? "Module"}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        This module hasn&apos;t been built yet for {client.company_name}. We&apos;re developing the application
        module by module, starting with Invoice Upload.
      </p>
      <Link
        to={`/clients/${client.id}/upload`}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Go to Upload Invoices
      </Link>
    </div>
  );
}
