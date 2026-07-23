import { apiClient } from "@/api/client";
import type { Client, ClientListResponse, ClientPayload, ClientStatus } from "@/types/client";

export async function listClients(
  params: { search?: string; status?: ClientStatus } = {}
): Promise<ClientListResponse> {
  const response = await apiClient.get<ClientListResponse>("/clients", { params });
  return response.data;
}

export async function getClient(clientId: string): Promise<Client> {
  const response = await apiClient.get<Client>(`/clients/${clientId}`);
  return response.data;
}

export async function createClient(payload: ClientPayload): Promise<Client> {
  const response = await apiClient.post<Client>("/clients", payload);
  return response.data;
}

export async function updateClient(clientId: string, payload: Partial<ClientPayload>): Promise<Client> {
  const response = await apiClient.patch<Client>(`/clients/${clientId}`, payload);
  return response.data;
}

export async function archiveClient(clientId: string): Promise<Client> {
  const response = await apiClient.post<Client>(`/clients/${clientId}/archive`);
  return response.data;
}

export async function unarchiveClient(clientId: string): Promise<Client> {
  const response = await apiClient.post<Client>(`/clients/${clientId}/unarchive`);
  return response.data;
}

export async function deleteClient(clientId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}`);
}
