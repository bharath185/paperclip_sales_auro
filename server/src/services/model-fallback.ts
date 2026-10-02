import { getModelMapping, getRetryConfig, getQuotaWarningThreshold, loadModelConfig } from "./model-config.js";

export interface FallbackExecutionOptions<T> {
  role?: string;
  primaryModel?: string;
  fallbackModel?: string;
  execute: (model: string, isFallback: boolean) => Promise<T>;
  onRetry?: (model: string, attempt: number, error: unknown) => void | Promise<void>;
  onFallback?: (primaryModel: string, fallbackModel: string, error: unknown) => void | Promise<void>;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface FallbackExecutionResult<T> {
  result: T;
  modelUsed: string;
  wasFallback: boolean;
  retriesAttempted: number;
}

export function isRetryableError(error: unknown, retryStatusCodes: number[] = [429, 500, 502, 503, 504]): boolean {
  if (!error) return false;
  
  if (typeof error === "object") {
    const err = error as Record<string, unknown>;
    
    // Check status or statusCode property
    const status = (typeof err.status === "number" ? err.status : undefined) ??
                   (typeof err.statusCode === "number" ? err.statusCode : undefined) ??
                   (typeof err.code === "number" ? err.code : undefined);
    if (typeof status === "number" && retryStatusCodes.includes(status)) {
      return true;
    }

    // Check message string for common rate-limit or 5xx patterns
    const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("quota exceeded") ||
      message.includes("too many requests") ||
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("server error") ||
      message.includes("service unavailable")
    ) {
      return true;
    }
  }

  return false;
}

export async function executeWithModelFallback<T>(
  options: FallbackExecutionOptions<T>,
): Promise<FallbackExecutionResult<T>> {
  const role = options.role || "default";
  const mapping = getModelMapping(role);
  const primaryModel = options.primaryModel || mapping.primary;
  const fallbackModel = options.fallbackModel || mapping.fallback;
  const retryConfig = getRetryConfig();
  const sleep = options.sleepFn || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let retriesAttempted = 0;
  let lastError: unknown;

  // Try primary model with retries
  for (let attempt = 0; attempt <= retryConfig.max_retries; attempt++) {
    try {
      const result = await options.execute(primaryModel, false);
      return {
        result,
        modelUsed: primaryModel,
        wasFallback: false,
        retriesAttempted,
      };
    } catch (error) {
      lastError = error;
      if (isRetryableError(error, retryConfig.retry_on_status_codes)) {
        if (attempt < retryConfig.max_retries) {
          retriesAttempted++;
          if (options.onRetry) {
            await options.onRetry(primaryModel, attempt + 1, error);
          }
          if (retryConfig.backoff_ms > 0) {
            await sleep(retryConfig.backoff_ms);
          }
          continue;
        }
      } else {
        // Non-retryable error, throw immediately
        throw error;
      }
    }
  }

  // If primary model failed with retryable error and fallback is configured, try fallback model
  if (fallbackModel && fallbackModel !== primaryModel) {
    if (options.onFallback) {
      await options.onFallback(primaryModel, fallbackModel, lastError);
    }

    try {
      const result = await options.execute(fallbackModel, true);
      return {
        result,
        modelUsed: fallbackModel,
        wasFallback: true,
        retriesAttempted,
      };
    } catch (fallbackError) {
      // Fallback also failed, rethrow fallback error
      throw fallbackError;
    }
  }

  // No fallback available, rethrow last error
  throw lastError;
}

export function resolveEffectiveModel(role?: string, requestedModel?: string): {
  primaryModel: string;
  fallbackModel: string;
  quotaWarningThreshold: number;
} {
  const mapping = getModelMapping(role || "default");
  return {
    primaryModel: requestedModel || mapping.primary,
    fallbackModel: mapping.fallback,
    quotaWarningThreshold: getQuotaWarningThreshold(),
  };
}
