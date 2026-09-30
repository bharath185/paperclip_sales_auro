import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

export interface ModelMapping {
  primary: string;
  fallback: string;
}

export interface ModelConfig {
  model_mapping: Record<string, ModelMapping> & { default: ModelMapping };
  quota_warning_threshold: number;
  retry: {
    max_retries: number;
    retry_on_status_codes: number[];
    backoff_ms: number;
  };
}

let cachedConfig: ModelConfig | null = null;

export function loadModelConfig(configPath?: string): ModelConfig {
  if (cachedConfig) return cachedConfig;

  const filePath = configPath || path.resolve(process.cwd(), "config", "models.yaml");
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Model config file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  cachedConfig = yaml.parse(content) as ModelConfig;
  
  if (!cachedConfig.model_mapping?.default) {
    throw new Error("Model config must have a 'default' mapping");
  }

  return cachedConfig;
}

export function getModelMapping(role: string, config?: ModelConfig): ModelMapping {
  const cfg = config || loadModelConfig();
  return cfg.model_mapping[role] || cfg.model_mapping.default;
}

export function getQuotaWarningThreshold(config?: ModelConfig): number {
  const cfg = config || loadModelConfig();
  return cfg.quota_warning_threshold;
}

export function getRetryConfig(config?: ModelConfig): ModelConfig["retry"] {
  const cfg = config || loadModelConfig();
  return cfg.retry;
}

export function clearModelConfigCache(): void {
  cachedConfig = null;
}