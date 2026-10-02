import fs from "node:fs";
import path from "node:path";

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

export function parseYamlSimple(yamlStr: string): ModelConfig {
  const result: any = {};
  const lines = yamlStr.split(/\r?\n/);
  const stack: { indent: number; obj: any; key?: string }[] = [{ indent: -1, obj: result }];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = rawLine.search(/\S/);
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1].obj;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let valStr = trimmed.slice(colonIdx + 1).trim();

    // Strip inline comment if any
    const commentIdx = valStr.indexOf("#");
    if (commentIdx !== -1) {
      // If starts with quote, only keep up to closing quote
      if (valStr.startsWith('"')) {
        const secondQuote = valStr.indexOf('"', 1);
        if (secondQuote !== -1) {
          valStr = valStr.slice(1, secondQuote).trim();
        }
      } else if (valStr.startsWith("'")) {
        const secondQuote = valStr.indexOf("'", 1);
        if (secondQuote !== -1) {
          valStr = valStr.slice(1, secondQuote).trim();
        }
      } else {
        valStr = valStr.slice(0, commentIdx).trim();
      }
    }

    if (valStr === "") {
      const newObj = {};
      current[key] = newObj;
      stack.push({ indent, obj: newObj, key });
    } else {
      if (valStr.startsWith("[") && valStr.endsWith("]")) {
        const items = valStr
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        current[key] = items.map((s) => {
          if (!isNaN(Number(s))) return Number(s);
          return s.replace(/^["'](.*)["']$/, "$1");
        });
      } else {
        valStr = valStr.replace(/^["'](.*)["']$/, "$1");
        if (!isNaN(Number(valStr)) && valStr !== "") {
          current[key] = Number(valStr);
        } else if (valStr === "true") {
          current[key] = true;
        } else if (valStr === "false") {
          current[key] = false;
        } else {
          current[key] = valStr;
        }
      }
    }
  }
  return result as ModelConfig;
}

export function stringifyYamlSimple(config: ModelConfig): string {
  const lines: string[] = [
    "# Auro Model Configuration",
    "# Maps roles to primary and fallback models for automatic failover",
    "model_mapping:",
  ];

  for (const [role, mapping] of Object.entries(config.model_mapping || {})) {
    lines.push(`  ${role}:`);
    lines.push(`    primary: "${mapping.primary}"`);
    lines.push(`    fallback: "${mapping.fallback}"`);
  }

  lines.push("");
  lines.push(`quota_warning_threshold: ${config.quota_warning_threshold ?? 80}`);
  lines.push("");
  lines.push("retry:");
  lines.push(`  max_retries: ${config.retry?.max_retries ?? 1}`);
  lines.push(
    `  retry_on_status_codes: [${(config.retry?.retry_on_status_codes || [429, 500, 502, 503, 504]).join(", ")}]`,
  );
  lines.push(`  backoff_ms: ${config.retry?.backoff_ms ?? 1000}`);
  lines.push("");

  return lines.join("\n");
}

export function resolveModelConfigPath(configPath?: string): string {
  if (configPath) return configPath;
  
  const local = path.resolve(process.cwd(), "config", "models.yaml");
  if (fs.existsSync(local)) return local;

  const parent = path.resolve(process.cwd(), "..", "config", "models.yaml");
  if (fs.existsSync(parent)) return parent;

  return local;
}

let cachedConfig: ModelConfig | null = null;

export function loadModelConfig(configPath?: string): ModelConfig {
  if (cachedConfig) return cachedConfig;

  const filePath = resolveModelConfigPath(configPath);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Model config file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  cachedConfig = parseYamlSimple(content);
  
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