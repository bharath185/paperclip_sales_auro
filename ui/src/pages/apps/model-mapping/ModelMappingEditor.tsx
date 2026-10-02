import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

const DEFAULT_ROLES = ["default", "governance", "sales", "developer"] as const;

function fetchModelConfig(): Promise<ModelConfig> {
  return fetch("/api/model-config").then((r) => {
    if (!r.ok) throw new Error("Failed to fetch model config");
    return r.json();
  });
}

function saveModelConfig(config: ModelConfig): Promise<ModelConfig> {
  return fetch("/api/model-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  }).then((r) => {
    if (!r.ok) throw new Error("Failed to save model config");
    return r.json();
  });
}

export function ModelMappingEditor() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const { data: fetchedConfig, isLoading, error: fetchError, refetch } = useQuery({
    queryKey: ["model-config"],
    queryFn: fetchModelConfig,
  });

  useEffect(() => {
    if (fetchedConfig) {
      setConfig(fetchedConfig);
      setDirty(false);
    }
  }, [fetchedConfig]);

  const handleChange = (role: string, field: "primary" | "fallback", value: string) => {
    if (!config) return;
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        model_mapping: {
          ...prev.model_mapping,
          [role]: {
            ...prev.model_mapping[role],
            [field]: value,
          },
        },
      };
    });
    setDirty(true);
  };

  const handleThresholdChange = (value: string) => {
    if (!config) return;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setConfig((prev) => (prev ? { ...prev, quota_warning_threshold: num } : prev));
      setDirty(true);
    }
  };

  const handleRetryChange = (field: keyof ModelConfig["retry"], value: string) => {
    if (!config) return;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setConfig((prev) =>
        prev ? { ...prev, retry: { ...prev.retry, [field]: num } } : prev
      );
      setDirty(true);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setStatus("saving");
    setError(null);
    try {
      await saveModelConfig(config);
      await queryClient.invalidateQueries({ queryKey: ["model-config"] });
      setStatus("saved");
      setDirty(false);
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleReset = () => {
    refetch();
    setDirty(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (fetchError || !config) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Failed to load model configuration</span>
      </div>
    );
  }

  const availableModels = [
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Model Mapping Editor</h1>
          <p className="text-muted-foreground">
            Configure primary and fallback models for each agent role. On 429/5xx, the system retries once then switches to the fallback.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!dirty || status === "saving"}>
            <RefreshCw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button onClick={handleSave} disabled={!dirty || status === "saving"}>
            {status === "saving" && <Save className="h-4 w-4 mr-2 animate-spin" />}
            {status === "saved" && <CheckCircle className="h-4 w-4 mr-2 text-green-500" />}
            Save
          </Button>
        </div>
      </div>

      {status === "error" && error && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === "saved" && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
          <span>Configuration saved successfully</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role Model Mappings</CardTitle>
          <CardDescription>
            Each role has a primary model and a fallback. On 429 (rate limit) or 5xx (server error), the system retries once then uses the fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DEFAULT_ROLES.map((role) => {
            const mapping = config.model_mapping[role] || config.model_mapping.default;
            return (
              <div key={role} className="space-y-3 p-4 border rounded-lg bg-background">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-2 py-1 text-xs font-medium rounded-full",
                    role === "default" ? "bg-blue-100 text-blue-800" :
                    role === "governance" ? "bg-purple-100 text-purple-800" :
                    role === "sales" ? "bg-green-100 text-green-800" :
                    "bg-orange-100 text-orange-800"
                  )}>
                    {role}
                  </span>
                  {role !== "default" && (
                    <span className="text-xs text-muted-foreground">(falls back to default if not set)</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor={`primary-${role}`}>Primary Model</Label>
                    <Select
                      value={mapping.primary}
                      onValueChange={(v) => handleChange(role, "primary", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select primary model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`fallback-${role}`}>Fallback Model</Label>
                    <Select
                      value={mapping.fallback}
                      onValueChange={(v) => handleChange(role, "fallback", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fallback model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quota Warning Threshold</CardTitle>
          <CardDescription>
            When quota usage reaches this percentage, a warning is shown in the Usage view and as an alert banner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="quota-threshold">Threshold (%)</Label>
            <Input
              id="quota-threshold"
              type="number"
              min="0"
              max="100"
              value={config.quota_warning_threshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
              className="w-30"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retry Configuration</CardTitle>
          <CardDescription>
            Settings for automatic retry on rate limits and server errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="max-retries">Max Retries</Label>
            <Input
              id="max-retries"
              type="number"
              min="0"
              max="10"
              value={config.retry.max_retries}
              onChange={(e) => handleRetryChange("max_retries", e.target.value)}
              className="w-30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="backoff">Backoff (ms)</Label>
            <Input
              id="backoff"
              type="number"
              min="0"
              max="60000"
              value={config.retry.backoff_ms}
              onChange={(e) => handleRetryChange("backoff_ms", e.target.value)}
              className="w-30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="retry-codes">Retry on Status Codes</Label>
            <Input
              id="retry-codes"
              type="text"
              value={config.retry.retry_on_status_codes.join(",")}
              onChange={(e) => handleRetryChange("retry_on_status_codes", e.target.value)}
              placeholder="429,500,502,503,504"
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}