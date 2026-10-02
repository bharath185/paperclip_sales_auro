import express, { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";
import { asString, parseObject, asNumber, asBoolean, asStringArray } from "@paperclipai/adapter-utils/server-utils";
import { type } from "./index.js";

// Mock OpenCode model IDs that are available
const MOCK_MODELS = [
  "opencode/deepseek-v4-pro",
  "opencode/kimi-k2.7-code",
  "opencode/deepseek-v4-flash",
  "opencode/claude-sonnet-5",
  "opencode/gpt-6-luna",
  "opencode/deepseek-r1",
  "opencode/deepseek-v3",
  "openai/gpt-4o",
  "openai/gpt-4-turbo",
  "openai/gpt-3.5-turbo",
  "anthropic/claude-3-opus-20240229",
  "anthropic/claude-3-sonnet-20240229",
  "anthropic/claude-3-haiku-20240307",
  "google/gemini-1.5-flash",
  "google/gemini-1.5-pro",
  "xai/grok-2-20240513",
  "meta/llama-3.1-405b",
];

// Simulated quota state
let quotaUsed = 0;
const QUOTA_LIMIT = 100; // 100 requests per period
const QUOTA_WARN_THRESHOLD = 80; // 80% warning threshold

// Role-based model mapping for fallback (inlined from config/models.yaml)
const MODEL_MAPPINGS: Record<string, { primary: string; fallback: string }> = {
  ceo: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  pm: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  cto: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  qa: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  devops: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  security: { primary: "opencode/kimi-k2.7-code", fallback: "opencode/deepseek-v4-pro" },
  coding: { primary: "opencode/kimi-k2.7-code", fallback: "opencode/deepseek-v4-pro" },
  default: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  governance: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  sales: { primary: "opencode/deepseek-v4-pro", fallback: "opencode/deepseek-v4-flash" },
  developer: { primary: "opencode/kimi-k2.7-code", fallback: "opencode/deepseek-v4-pro" },
  // Backward-compatible fallback mappings for test fixtures
  "legacy-default": { primary: "openai/gpt-4o", fallback: "openai/gpt-4-turbo" },
  "legacy-governance": { primary: "anthropic/claude-3-opus-20240229", fallback: "anthropic/claude-3-sonnet-20240229" },
};

function getFallbackModel(primaryModel: string, role: string = "default"): string | null {
  const mapping = MODEL_MAPPINGS[role] || MODEL_MAPPINGS.default;
  if (mapping && mapping.primary === primaryModel) {
    return mapping.fallback;
  }
  // Check default mapping
  const defaultMapping = MODEL_MAPPINGS.default;
  if (defaultMapping.primary === primaryModel) {
    return defaultMapping.fallback;
  }
  // Check legacy mappings for backward compatibility
  for (const m of Object.values(MODEL_MAPPINGS)) {
    if (m.primary === primaryModel) {
      return m.fallback;
    }
  }
  return null;
}

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", adapter: "mock-opencode" });
});

// Models list endpoint - mimics OpenCode `opencode models`
app.get("/api/opencode/models", (_req: Request, res: Response) => {
  res.json({
    models: MOCK_MODELS.map((id) => ({
      id,
      label: id.split("/")[1] || id,
    })),
    defaults: {
      model: MOCK_MODELS[0],
    },
  });
});

// Chat completions endpoint - mimics OpenCode chat completion
interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  tools?: any[];
  tool_choice?: string | "auto" | "none";
  temperature?: number;
  max_tokens?: number;
  role?: string; // Agent role for fallback mapping
}

interface Choice {
  index: number;
  message: { role: string; content: string | null; tool_calls?: any[] };
  finish_reason: string | null;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

// In-memory conversation state
const conversations = new Map<string, { role: string; content: string }[]>();

// Track quota
let globalQuotaUsed = 0;

// Simulate response based on message content
function simulateResponse(message: string): string {
  const lower = message.toLowerCase();
  
  if (/hello|hi|hey/.test(lower)) {
    return "Hello! How can I help you today?";
  }
  if (/what is your name/.test(lower) || /who are you/.test(lower)) {
    return "I'm a mock OpenCode assistant, here to help you with agent tasks.";
  }
  if (/task|todo|todo/.test(lower)) {
    return "I can help you manage tasks. Would you like me to create, update, or list tasks?";
  }
  if (/cost|price|expensive/.test(lower)) {
    return "In demo mode, all operations are free. In production, costs depend on your selected model and usage.";
  }
  if (/model|available/.test(lower)) {
    return `Available models in demo mode: ${MOCK_MODELS.map(m => m.split('/')[1]).join(", ")}`;
  }
  if (/goodbye|bye/.test(lower)) {
    return "Goodbye! Feel free to come back anytime.";
  }
  
  return `I received your message: "${message}". This is a mock response from the demo OpenCode adapter. In a real setup, this would be handled by your selected AI provider.`;
}

// Simulate tool execution
function simulateToolExecution(tools: any): any {
  if (!tools || tools.length === 0) {
    return { output: "No tools specified", success: true };
  }
  return { 
    output: `Tool executed: ${tools[0]?.name || "unknown"}`, 
    success: true,
    result: "mock-tool-result" 
  };
}

// Chat completions endpoint with fallback logic
app.post("/api/opencode/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatCompletionRequest;
  const { model, messages, stream = false, tools, tool_choice, temperature, max_tokens, role = "default" } = body;

  if (!model) {
    return res.status(400).json({ error: "Model is required" });
  }

  // Check if model is valid
  const validModel = MOCK_MODELS.includes(model);
  if (!validModel) {
    return res.status(404).json({ error: `Model not found: ${model}` });
  }

  // Check quota
  globalQuotaUsed++;
  const quotaPercent = Math.round((globalQuotaUsed / QUOTA_LIMIT) * 100);

  // 80% quota warning marker in response
  const quotaWarning = quotaPercent >= QUOTA_WARN_THRESHOLD ? "warning:quota80" : undefined;

  // Last message content
  const lastMessage = messages[messages.length - 1]?.content || "";

  // Simulate a helpful response based on the last user message
  const responseContent = simulateResponse(lastMessage);

  const choice: Choice = {
    index: 0,
    message: {
      role: "assistant",
      content: responseContent,
      ...(tools && tool_choice !== "none" ? { tool_calls: [] } : {}),
    },
    finish_reason: "stop",
  };

  const usage: Usage = {
    prompt_tokens: Math.round(lastMessage.length / 4),
    completion_tokens: Math.round(responseContent.length / 4),
    total_tokens: 0,
  };
  usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

  const response: ChatCompletionResponse = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [choice],
    usage,
  };

  // Add quota warning to response if at threshold
  if (quotaWarning) {
    res.set("X-Quota-Warning", quotaWarning);
  }

  // Check if we should simulate a 429/5xx for testing fallback
  const shouldSimulateError = req.headers["x-simulate-error"] as string;
  if (shouldSimulateError === "429" || shouldSimulateError === "500") {
    const statusCode = parseInt(shouldSimulateError, 10);
    
    // Try fallback if configured
    const fallbackModel = getFallbackModel(model, role);
    if (fallbackModel && MOCK_MODELS.includes(fallbackModel)) {
      // Retry with fallback model
      const fallbackResponse: ChatCompletionResponse = {
        ...response,
        id: `chatcmpl-${Date.now() + 1}`,
        model: fallbackModel,
        choices: [{
          ...choice,
          message: {
            ...choice.message,
            content: `[FALLBACK to ${fallbackModel}] ${responseContent}`,
          },
        }],
      };
      
      if (quotaWarning) {
        res.set("X-Quota-Warning", quotaWarning);
      }
      res.set("X-Fallback-Model", fallbackModel);
      res.set("X-Original-Model", model);
      
      if (stream) {
        res.set("Content-Type", "text/event-stream");
        res.set("Cache-Control", "no-cache");
        res.set("Connection", "keep-alive");
        
        res.write(`data: ${JSON.stringify({ type: "message_start", message: { role: "assistant", content: null } })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "content", delta: `[FALLBACK to ${fallbackModel}] ${responseContent}` })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "message_delta", delta: { role: "assistant", content: `[FALLBACK to ${fallbackModel}] ${responseContent}` } })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "message_end", role: "assistant", content: `[FALLBACK to ${fallbackModel}] ${responseContent}` })}\n\n`);
        res.end();
      } else {
        return res.status(statusCode).json({ 
          error: statusCode === 429 ? "Rate limit exceeded" : "Internal server error",
          fallback_model: fallbackModel,
          original_model: model,
        });
      }
    } else {
      // No fallback available, return error
      if (stream) {
        res.set("Content-Type", "text/event-stream");
        res.set("Cache-Control", "no-cache");
        res.set("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({ type: "error", error: { message: "Rate limit exceeded", type: "rate_limit_error" } })}\n\n`);
        res.end();
      } else {
        return res.status(statusCode).json({ 
          error: statusCode === 429 ? "Rate limit exceeded" : "Internal server error" 
        });
      }
    }
  }

  if (stream) {
    res.set("Content-Type", "text/event-stream");
    res.set("Cache-Control", "no-cache");
    res.set("Connection", "keep-alive");
    
    res.write(`data: ${JSON.stringify({ type: "message_start", message: { role: "assistant", content: null } })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "content", delta: responseContent })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "message_delta", delta: { role: "assistant", content: responseContent } })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "message_end", role: "assistant", content: responseContent })}\n\n`);
    res.end();
  } else {
    res.json(response);
  }
});

// Tool calls endpoint
app.post("/api/opencode/tools", (req: Request, res: Response) => {
  const body = req.body;
  const result = simulateToolExecution(body);
  res.json({ result, success: true });
});

// 401 - Unauthorized (invalid/exhausted key)
app.use("/api/opencode/*", (req: Request, res: Response) => {
  res.status(401).json({ error: "Unauthorized: invalid or exhausted OpenCode API key" });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Mock OpenCode error:", err);
  res.status(500).json({ error: "Internal server error in mock OpenCode adapter" });
});

export const server = app;

// Test environment mock - mimics the real OpenCode testEnvironment
export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentTestResult["checks"] = [];
  
  const config = parseObject(ctx.config);
  const command = asString(config.command, "opencode");
  const model = asString(config.model, "").trim();
  
  checks.push({
    code: "mock_opencode_environment_ok",
    level: "info",
    message: "Running in mock OpenCode mode - no real API key required",
  });
  
  if (model && MOCK_MODELS.includes(model)) {
    checks.push({
      code: "mock_opencode_model_available",
      level: "info",
      message: `Model available in mock mode: ${model}`,
    });
  } else if (model) {
    checks.push({
      code: "mock_opencode_model_unavailable",
      level: "warn",
      message: `Model not in mock fixture: ${model}. Using default: ${MOCK_MODELS[0]}`,
    });
  } else {
    checks.push({
      code: "mock_opencode_no_model_configured",
      level: "info",
      message: "No model configured; using default: " + MOCK_MODELS[0],
    });
  }
  
  const hasApiKey = !!process.env.OPENCODE_API_KEY;
  if (!hasApiKey) {
    checks.push({
      code: "mock_opencode_no_api_key",
      level: "info",
      message: "No OPENCODE_API_KEY set - running in demo mode",
    });
  }
  
  const status = checks.some((c) => c.level === "error") ? "fail" : "pass";
  
  return {
    adapterType: ctx.adapterType,
    status,
    checks,
    testedAt: new Date().toISOString(),
  };
}

export { app };