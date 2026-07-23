import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getClient } from "@/api/clients";
import { AppShell } from "@/components/layout/AppShell";
import { ClientProvider } from "@/context/ClientContext";
import type { Client } from "@/types/client";

/** Loads the client for the current route and provides it to every nested
 * page via ClientContext, so all processing (upload, masters, review, ...)
 * happens only inside that client's scope. */
export function ClientShell() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchClient = useCallback(() => {
    if (!clientId) return;
    getClient(clientId)
      .then(setClient)
      .catch(() => setNotFound(true));
  }, [clientId]);

  useEffect(() => {
    setClient(null);
    setNotFound(false);
    fetchClient();
  }, [fetchClient]);

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <ClientProvider client={client} refreshClient={fetchClient}>
      <AppShell>
        <Outlet />
      </AppShell>
    </ClientProvider>
  );
}
