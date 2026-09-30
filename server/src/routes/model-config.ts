import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertBoard, getActorInfo } from "./authz.js";
import { logActivity } from "../services/activity-log.js";
import { loadModelConfig, clearModelConfigCache, type ModelConfig, type ModelMapping } from "../services/model-config.js";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

export function modelConfigRoutes(db: Db) {
  const router = Router();

  const ModelMappingSchema = z.object({
    primary: z.string().min(1),
    fallback: z.string().min(1),
  });

  const RetryConfigSchema = z.object({
    max_retries: z.number().int().min(0).max(10),
    retry_on_status_codes: z.array(z.number().int()).min(1),
    backoff_ms: z.number().int().min(0),
  });

  const ModelConfigSchema = z.object({
    model_mapping: z.record(z.string(), ModelMappingSchema),
    quota_warning_threshold: z.number().int().min(0).max(100),
    retry: RetryConfigSchema,
  });

  type ModelConfigInput = z.infer<typeof ModelConfigSchema>;
  type ModelMapping = z.infer<typeof ModelMappingSchema>;

  function getConfigPath(): string {
    return path.resolve(process.cwd(), "config", "models.yaml");
  }

  function writeModelConfig(config: ModelConfig): void {
    const configPath = getConfigPath();
    const content = yaml.stringify(config);
    fs.writeFileSync(configPath, content, "utf8");
    clearModelConfigCache();
  }

  // GET /api/model-config - Get current model configuration
  router.get("/model-config", (_req: Request, res: Response) => {
    try {
      const config = loadModelConfig();
      res.json(config);
    } catch (e) {
      console.error("Failed to load model config:", e);
      res.status(500).json({ error: "Failed to load model configuration" });
    }
  });

  // POST /api/model-config - Save model configuration
  router.post("/model-config", assertBoard, async (req: Request, res: Response) => {
    try {
      const parsed = ModelConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid configuration", details: parsed.error.flatten() });
      }

      const input = parsed.data as ModelConfigInput;
      
      // Ensure default mapping exists
      if (!input.model_mapping.default) {
        return res.status(400).json({ error: "Default mapping is required" });
      }

      // Convert to ModelConfig type (with default required)
      const config: ModelConfig = {
        model_mapping: input.model_mapping as Record<string, ModelMapping> & { default: ModelMapping },
        quota_warning_threshold: input.quota_warning_threshold,
        retry: input.retry,
      };

      writeModelConfig(config);

      await logActivity(db, {
        companyId: "instance",
        actorType: "user",
        actorId: getActorInfo(req).actorId,
        action: "model_config.updated",
        entityType: "instance",
        entityId: "model-config",
        details: { roles: Object.keys(config.model_mapping) },
      });

      res.json(config);
    } catch (e) {
      console.error("Failed to save model config:", e);
      res.status(500).json({ error: "Failed to save model configuration" });
    }
  });

  return router;
}