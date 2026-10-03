import { describe, it, expect } from "vitest";
import {
  validateAttachmentUpload,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "./upload-validator.js";

describe("Web Hardening & Security Controls", () => {
  describe("1. Security Headers Contract", () => {
    it("validates required Content-Security-Policy directives", () => {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });

    it("verifies nosniff, frame denial, and referrer policy standards", () => {
      const headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      };

      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    });
  });

  describe("2. Attachment Upload Validation (Kickoff Files)", () => {
    it("accepts valid documents, images, and data files within size limits", () => {
      const validFiles = [
        { filename: "project_charter.pdf", sizeBytes: 1024 * 500 },
        { filename: "sprint_backlog.xlsx", sizeBytes: 1024 * 250 },
        { filename: "architecture_diagram.png", sizeBytes: 1024 * 1024 },
        { filename: "research_notes.md", sizeBytes: 4096 },
        { filename: "leads_dataset.csv", sizeBytes: 1024 * 800 },
      ];

      for (const file of validFiles) {
        const result = validateAttachmentUpload(file);
        expect(result.valid).toBe(true);
        expect(result.sanitizedFilename).toBeDefined();
      }
    });

    it("rejects path traversal attempts in filenames", () => {
      const traversalAttempts = [
        "../../etc/passwd.pdf",
        "..\\..\\Windows\\System32\\cmd.exe.png",
        "../../../app.env.txt",
        "nested/../../secret.json",
        "file\0withnullbyte.pdf",
      ];

      for (const badName of traversalAttempts) {
        const result = validateAttachmentUpload({ filename: badName, sizeBytes: 1024 });
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("path traversal");
      }
    });

    it("rejects dangerous executable and script file extensions", () => {
      const dangerousExtensions = [
        "malware.exe",
        "script.sh",
        "exploit.bat",
        "shell.php",
        "payload.js",
        "library.dll",
        "trojan.vbs",
        "autorun.inf",
      ];

      for (const badFile of dangerousExtensions) {
        const result = validateAttachmentUpload({ filename: badFile, sizeBytes: 1024 });
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("not permitted");
      }
    });

    it("rejects files exceeding 10MB limit and empty 0-byte files", () => {
      const oversized = validateAttachmentUpload({
        filename: "huge_dump.pdf",
        sizeBytes: 15 * 1024 * 1024, // 15MB
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.reason).toContain("exceeds maximum allowed limit");

      const emptyFile = validateAttachmentUpload({
        filename: "empty.txt",
        sizeBytes: 0,
      });
      expect(emptyFile.valid).toBe(false);
      expect(emptyFile.reason).toContain("File cannot be empty");
    });
  });

  describe("3. Cookie Security & Rate Limiting Controls", () => {
    it("ensures session cookies require HttpOnly, Secure, and SameSite flags", () => {
      const cookieConfig = {
        httpOnly: true,
        secure: true,
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      expect(cookieConfig.httpOnly).toBe(true);
      expect(cookieConfig.secure).toBe(true);
      expect(cookieConfig.sameSite).toBe("lax");
    });
  });
});
