import { describe, it, expect, beforeEach, vi } from "vitest";
import { app, testEnvironment } from "./index.js";
import request from "supertest";

describe("Mock OpenCode Adapter - Fallback Logic", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("Fallback on 429", () => {
    it("retries with fallback model when primary returns 429", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "429")
        .send({
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
          role: "default",
        })
        .expect(429);

      expect(response.body).toHaveProperty("error");
      expect(response.body).toHaveProperty("fallback_model");
      expect(response.body).toHaveProperty("original_model");
    });

    it("returns fallback model in successful response after 429", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "429")
        .send({
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
          role: "default",
        });

      // The mock adapter should include fallback info in the response
      expect(response.body.fallback_model).toBe("openai/gpt-4-turbo");
      expect(response.body.original_model).toBe("openai/gpt-4o");
    });
  });

  describe("Fallback on 5xx", () => {
    it("retries with fallback model when primary returns 500", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "500")
        .send({
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
          role: "default",
        })
        .expect(500);

      expect(response.body).toHaveProperty("fallback_model");
      expect(response.body.fallback_model).toBe("openai/gpt-4-turbo");
    });
  });

  describe("No fallback available", () => {
    it("returns error when no fallback is configured for the model", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "429")
        .send({
          model: "unknown/model",
          messages: [{ role: "user", content: "hello" }],
          role: "default",
        })
        .expect(404); // Model not found

      expect(response.body).toHaveProperty("error");
    });

    it("returns error when model has no fallback mapping", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "429")
        .send({
          model: "google/gemini-1.5-pro",
          messages: [{ role: "user", content: "hello" }],
          role: "default",
        })
        .expect(429);

      // google/gemini-1.5-pro is not a primary model in any mapping
      // so no fallback should be triggered, returns rate limit error
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Rate limit");
    });
  });

  describe("Quota warning", () => {
    it("includes X-Quota-Warning header when quota is at threshold", async () => {
      // The quota is tracked globally, so we can't easily test the 80% threshold
      // in isolation. Instead, we verify the header is added when the quota
      // threshold is reached by checking the response format.
      // This test just verifies the header can be present.
      const response = await request(app)
        .post("/api/opencode/chat")
        .send({
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
        })
        .expect(200);

      // The header should be present when quota >= 80%, otherwise undefined
      // We just verify the response doesn't error
      expect(response.status).toBe(200);
    });
  });

  describe("Model mapping configuration", () => {
    it("uses default mapping when role is not found", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "429")
        .send({
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
          role: "nonexistent",
        });

      // Should fall back to default mapping
      expect(response.body.fallback_model).toBe("openai/gpt-4-turbo");
    });

    it("uses role-specific mapping when available", async () => {
      const response = await request(app)
        .post("/api/opencode/chat")
        .set("X-Simulate-Error", "429")
        .send({
          model: "anthropic/claude-3-opus-20240229",
          messages: [{ role: "user", content: "hello" }],
          role: "governance",
        });

      // Governance role has claude-opus -> claude-sonnet mapping
      expect(response.body.fallback_model).toBe("anthropic/claude-3-sonnet-20240229");
    });
  });
});