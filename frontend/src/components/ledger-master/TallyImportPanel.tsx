import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { extractErrorMessage } from "@/api/client";
import { importTallyMaster } from "@/api/ledgerMaster";
import { ProgressBar } from "@/components/common/ProgressBar";
import { cn } from "@/lib/cn";
import type { LedgerMasterImportRecord } from "@/types/ledger";

interface TallyImportPanelProps {
  clientId: string;
  onImported: (record: LedgerMasterImportRecord) => void;
}

export function TallyImportPanel({ clientId, onImported }: TallyImportPanelProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LedgerMasterImportRecord | null>(null);

  const runImport = useCallback(
    async (file: File) => {
      setStatus("uploading");
      setProgress(0);
      setErrorMessage(null);
      try {
        const record = await importTallyMaster(clientId, file, { onProgress: setProgress });
        setStatus("idle");
        setLastResult(record);
        onImported(record);
      } catch (error) {
        setStatus("error");
        setErrorMessage(extractErrorMessage(error, "Import failed. Please check the file and try again."));
      }
    },
    [clientId, onImported]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) runImport(acceptedFiles[0]);
    },
    [runImport]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "text/xml": [".xml"], "application/xml": [".xml"] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragActive
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
          : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
        {status === "uploading" ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
      </div>

      {status === "uploading" && (
        <div className="w-full max-w-xs">
          <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">Importing Tally master…</p>
          <ProgressBar value={progress} />
        </div>
      )}

      {status !== "uploading" && (
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Drag and drop a Tally Masters XML export here, or choose a file
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Export from Tally: Gateway of Tally &rarr; Display &rarr; List of Accounts &rarr; Export (XML)
          </p>
        </div>
      )}

      {status !== "uploading" && (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <FileUp className="h-4 w-4" />
          Select Tally XML File
        </button>
      )}

      {status === "error" && errorMessage && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {lastResult && status === "idle" && (
        <div className="w-full max-w-lg space-y-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Imported {lastResult.ledger_count} ledgers, {lastResult.group_count} groups,{" "}
            {lastResult.cost_centre_count} cost centres from {lastResult.filename}
          </div>
          {lastResult.warnings && lastResult.warnings.length > 0 && (
            <ul className="ml-6 list-disc text-xs text-amber-700 dark:text-amber-400">
              {lastResult.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
