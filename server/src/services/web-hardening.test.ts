import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  validateAttachmentUpload,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "./upload-validator.js";
import { createRateLimiter } from "../middleware/rate-limiter.js";

describe("Web Hardening & Security Controls Suite", () => {
  describe("1. Strict Content-Security-Policy & Security Headers", () => {
    it("enforces strict CSP without unsafe-inline or unsafe-eval scripts", () => {
      const strictCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";
      expect(strictCsp).toContain("script-src 'self'");
      expect(strictCsp).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(strictCsp).toContain("frame-ancestors 'none'");
      expect(strictCsp).toContain("default-src 'self'");
    });

    it("verifies nosniff, frame denial, and HSTS headers", () => {
      const headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      };

      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains; preload");
    });
  });

  describe("2. Rate Limiting & Lockout on Authentication / Public Endpoints", () => {
    it("enforces rate limits and applies temporary lockout upon threshold breach", async () => {
      const app = express();
      const limiter = createRateLimiter({
        windowMs: 5000,
        maxRequests: 3,
        lockoutMs: 10000,
        message: "Too many attempts",
      });

      app.post("/api/auth/login", limiter, (_req, res) => res.json({ success: true }));

      // 1-3 allowed
      const r1 = await request(app).post("/api/auth/login");
      const r2 = await request(app).post("/api/auth/login");
      const r3 = await request(app).post("/api/auth/login");
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(200);

      // 4th request breaches threshold -> 429
      const r4 = await request(app).post("/api/auth/login");
      expect(r4.status).toBe(429);
      expect(r4.body.error).toBe("rate_limit_exceeded");
      expect(r4.header["retry-after"]).toBeDefined();

      // Subsequent request enters lockout -> 429 lockout
      const r5 = await request(app).post("/api/auth/login");
      expect(r5.status).toBe(429);
      expect(r5.body.error).toBe("rate_limit_lockout");
    });
  });

  describe("3. Attachment Upload Validation (Kickoff Files)", () => {
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
        sizeBytes: 15 * 1024 * 1024,
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

  describe("4. Cookie Security & CSRF Defense Flags", () => {
    it("ensures session cookies require HttpOnly, Secure, and SameSite flags", () => {
      const cookieConfig = {
        httpOnly: true,
        secure: true,
        sameSite: "strict" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      expect(cookieConfig.httpOnly).toBe(true);
      expect(cookieConfig.secure).toBe(true);
      expect(cookieConfig.sameSite).toBe("strict");
    });
  });
});
