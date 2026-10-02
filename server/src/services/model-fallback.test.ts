import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeWithModelFallback,
  isRetryableError,
  resolveEffectiveModel,
} from "./model-fallback.js";
import { clearModelConfigCache } from "./model-config.js";

describe("Model Fallback Service", () => {
  beforeEach(() => {
    clearModelConfigCache();
  });

  describe("isRetryableError", () => {
    it("identifies status code 429 as retryable", () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ statusCode: 429 })).toBe(true);
    });

    it("identifies 5xx status codes as retryable", () => {
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 504 })).toBe(true);
    });

    it("identifies error message strings with rate limits / 5xx", () => {
      expect(isRetryableError(new Error("Rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("HTTP 429: Too Many Requests"))).toBe(true);
      expect(isRetryableError(new Error("Internal server error 500"))).toBe(true);
    });

    it("does not mark 400 or 401 or 404 as retryable", () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
      expect(isRetryableError(new Error("Unauthorized access"))).toBe(false);
    });
  });

  describe("resolveEffectiveModel", () => {
    it("resolves role-specific primary and fallback models from config/models.yaml", () => {
      const gov = resolveEffectiveModel("governance");
      expect(gov.primaryModel).toBe("opencode/deepseek-r1");
      expect(gov.fallbackModel).toBe("opencode/deepseek-v3");
      expect(gov.quotaWarningThreshold).toBe(80);

      const sales = resolveEffectiveModel("sales");
      expect(sales.primaryModel).toBe("opencode/gpt-6-luna");
      expect(sales.fallbackModel).toBe("opencode/deepseek-v3");

      const dev = resolveEffectiveModel("developer");
      expect(dev.primaryModel).toBe("opencode/claude-sonnet-5");
      expect(dev.fallbackModel).toBe("opencode/deepseek-v3");
    });

    it("falls back to default role mapping for unknown roles", () => {
      const unknown = resolveEffectiveModel("unknown_role");
      expect(unknown.primaryModel).toBe("opencode/claude-sonnet-5");
      expect(unknown.fallbackModel).toBe("opencode/deepseek-r1");
    });

    it("honors requested custom primary model", () => {
      const custom = resolveEffectiveModel("governance", "custom-model");
      expect(custom.primaryModel).toBe("custom-model");
      expect(custom.fallbackModel).toBe("opencode/deepseek-v3");
    });
  });

  describe("executeWithModelFallback", () => {
    it("executes successfully with primary model without fallback or retry", async () => {
      const execute = vi.fn().mockResolvedValue("success-output");
      const result = await executeWithModelFallback({
        role: "governance",
        execute,
      });

      expect(result.result).toBe("success-output");
      expect(result.modelUsed).toBe("opencode/deepseek-r1");
      expect(result.wasFallback).toBe(false);
      expect(result.retriesAttempted).toBe(0);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith("opencode/deepseek-r1", false);
    });

    it("retries on 429 and succeeds on second attempt", async () => {
      let attempts = 0;
      const execute = vi.fn().mockImplementation(async (model) => {
        attempts++;
        if (attempts === 1) {
          throw { status: 429, message: "Rate limit exceeded" };
        }
        return "success-after-retry";
      });

      const onRetry = vi.fn();
      const sleepFn = vi.fn().mockResolvedValue(undefined);

      const result = await executeWithModelFallback({
        role: "governance",
        execute,
        onRetry,
        sleepFn,
      });

      expect(result.result).toBe("success-after-retry");
      expect(result.modelUsed).toBe("opencode/deepseek-r1");
      expect(result.wasFallback).toBe(false);
      expect(result.retriesAttempted).toBe(1);
      expect(execute).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(sleepFn).toHaveBeenCalledWith(1000);
    });

    it("falls back to secondary model when primary model exhausts retries with 429", async () => {
      const execute = vi.fn().mockImplementation(async (model, isFallback) => {
        if (!isFallback) {
          throw { status: 429, message: "Rate limit exceeded" };
        }
        return "success-from-fallback";
      });

      const onFallback = vi.fn();
      const sleepFn = vi.fn().mockResolvedValue(undefined);

      const result = await executeWithModelFallback({
        role: "governance",
        execute,
        onFallback,
        sleepFn,
      });

      expect(result.result).toBe("success-from-fallback");
      expect(result.modelUsed).toBe("opencode/deepseek-v3");
      expect(result.wasFallback).toBe(true);
      expect(result.retriesAttempted).toBe(1);
      expect(onFallback).toHaveBeenCalledWith(
        "opencode/deepseek-r1",
        "opencode/deepseek-v3",
        expect.objectContaining({ status: 429 }),
      );
    });

    it("falls back to secondary model on 500 internal server error", async () => {
      const execute = vi.fn().mockImplementation(async (model, isFallback) => {
        if (!isFallback) {
          throw { status: 500, message: "Internal server error" };
        }
        return "fallback-response";
      });

      const onFallback = vi.fn();
      const sleepFn = vi.fn().mockResolvedValue(undefined);

      const result = await executeWithModelFallback({
        role: "sales",
        execute,
        onFallback,
        sleepFn,
      });

      expect(result.result).toBe("fallback-response");
      expect(result.modelUsed).toBe("opencode/deepseek-v3");
      expect(result.wasFallback).toBe(true);
      expect(onFallback).toHaveBeenCalledWith(
        "opencode/gpt-6-luna",
        "opencode/deepseek-v3",
        expect.objectContaining({ status: 500 }),
      );
    });

    it("fails immediately on non-retryable 401 error without fallback", async () => {
      const execute = vi.fn().mockRejectedValue({ status: 401, message: "Unauthorized" });

      await expect(
        executeWithModelFallback({
          role: "governance",
          execute,
        }),
      ).rejects.toEqual({ status: 401, message: "Unauthorized" });

      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
