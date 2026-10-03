import path from "node:path";

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".xlsx",
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface AttachmentUploadInput {
  filename: string;
  sizeBytes: number;
  mimeType?: string;
  buffer?: Buffer;
}

export interface AttachmentValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedFilename?: string;
}

/**
 * Validates file uploads for project kickoff attachments, preventing path traversal,
 * oversized payloads, and dangerous executable file types.
 */
export function validateAttachmentUpload(
  input: AttachmentUploadInput
): AttachmentValidationResult {
  if (!input.filename || typeof input.filename !== "string") {
    return { valid: false, reason: "Filename is required" };
  }

  // 1. Path traversal & control character checks
  if (
    input.filename.includes("../") ||
    input.filename.includes("..\\") ||
    input.filename.includes("\0") ||
    /[\x00-\x1F\x7F]/.test(input.filename)
  ) {
    return { valid: false, reason: "Filename contains illegal path traversal or control characters" };
  }

  // Extract base filename without directories
  const basename = path.basename(input.filename.trim());
  if (!basename || basename === "." || basename === "..") {
    return { valid: false, reason: "Invalid filename" };
  }

  // 2. Extension Allowlist Check
  const ext = path.extname(basename).toLowerCase();
  if (!ext || !ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      reason: `File extension '${ext || "none"}' is not permitted. Allowed: ${Array.from(
        ALLOWED_ATTACHMENT_EXTENSIONS
      ).join(", ")}`,
    };
  }

  // 3. File Size Validation
  if (input.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      reason: `File size (${(input.sizeBytes / (1024 * 1024)).toFixed(
        2
      )} MB) exceeds maximum allowed limit of 10 MB`,
    };
  }

  if (input.sizeBytes <= 0) {
    return { valid: false, reason: "File cannot be empty" };
  }

  // Sanitize filename to safe alphanumeric + hyphens/underscores/dots
  const safeFilename = basename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return {
    valid: true,
    sanitizedFilename: safeFilename,
  };
}
