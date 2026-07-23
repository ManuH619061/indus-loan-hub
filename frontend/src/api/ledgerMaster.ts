import { apiClient } from "@/api/client";
import type {
  CostCentre,
  Ledger,
  LedgerListResponse,
  LedgerMasterImportRecord,
  LedgerMasterSummary,
  LedgerType,
  LedgerUpdatePayload,
} from "@/types/ledger";

interface ImportOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function importTallyMaster(
  clientId: string,
  file: File,
  options: ImportOptions = {}
): Promise<LedgerMasterImportRecord> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<LedgerMasterImportRecord>(
    `/clients/${clientId}/ledger-master/import`,
    formData,
    {
      signal: options.signal,
      onUploadProgress: (event) => {
        if (!options.onProgress || !event.total) return;
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }
  );
  return response.data;
}

export async function getLedgerMasterSummary(clientId: string): Promise<LedgerMasterSummary> {
  const response = await apiClient.get<LedgerMasterSummary>(`/clients/${clientId}/ledger-master/summary`);
  return response.data;
}

export async function listLedgers(
  clientId: string,
  params: { search?: string; ledger_type?: LedgerType; skip?: number; limit?: number } = {}
): Promise<LedgerListResponse> {
  const response = await apiClient.get<LedgerListResponse>(`/clients/${clientId}/ledger-master/ledgers`, {
    params,
  });
  return response.data;
}

export async function updateLedger(clientId: string, ledgerId: string, payload: LedgerUpdatePayload): Promise<Ledger> {
  const response = await apiClient.patch<Ledger>(
    `/clients/${clientId}/ledger-master/ledgers/${ledgerId}`,
    payload
  );
  return response.data;
}

export async function listCostCentres(clientId: string): Promise<CostCentre[]> {
  const response = await apiClient.get<CostCentre[]>(`/clients/${clientId}/ledger-master/cost-centres`);
  return response.data;
}
