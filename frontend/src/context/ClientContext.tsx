import { createContext, type ReactNode, useContext } from "react";
import type { Client } from "@/types/client";

interface ClientContextValue {
  client: Client;
  refreshClient: () => void;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({ client, refreshClient, children }: ClientContextValue & { children: ReactNode }) {
  return <ClientContext.Provider value={{ client, refreshClient }}>{children}</ClientContext.Provider>;
}

export function useCurrentClient(): ClientContextValue {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useCurrentClient must be used within a client workspace route");
  }
  return context;
}
