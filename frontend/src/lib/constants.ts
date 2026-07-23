export const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

export const MAX_FILE_SIZE_MB = 25;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const MAX_BATCH_FILES = 1000;

export const UPLOAD_CONCURRENCY = 4;
