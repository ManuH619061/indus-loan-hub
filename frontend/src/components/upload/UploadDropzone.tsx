import { useCallback, useRef } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { FolderUp, UploadCloud } from "lucide-react";
import { cn } from "@/lib/cn";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from "@/lib/constants";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);

  // react-dropzone's own `accept` filter silently drops files it doesn't
  // recognize (fileRejections), which would hide them from the user. Route
  // both accepted and rejected files through our own validation instead, so
  // an unsupported file still shows up in the queue with a clear error.
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const allFiles = [...acceptedFiles, ...fileRejections.map((rejection) => rejection.file)];
      if (allFiles.length > 0) onFilesSelected(allFiles);
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ALLOWED_MIME_TYPES,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFilesSelected(files);
    event.target.value = "";
  };

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
        <UploadCloud className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Drag and drop invoices here, or choose an option below
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Supports PDF, JPG, JPEG, PNG &middot; up to {MAX_FILE_SIZE_MB} MB per file &middot; up to 1,000 files
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UploadCloud className="h-4 w-4" />
          Select Files
        </button>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FolderUp className="h-4 w-4" />
          Select Folder
        </button>
      </div>
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error non-standard attributes required for folder selection
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleFolderChange}
      />
    </div>
  );
}
