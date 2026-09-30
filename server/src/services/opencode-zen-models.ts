import type { AdapterModel } from "@paperclipai/adapter-utils";

let cached: { until: number; models: AdapterModel[] } | undefined;
let pending: Promise<AdapterModel[]> | undefined;

/** OpenCode documents this catalog as a public model list; it does not validate credentials. */
export async function listOpenCodeZenModels(refresh = false): Promise<AdapterModel[]> {
  if (!refresh && cached && cached.until > Date.now()) return cached.models;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch("https://opencode.ai/zen/v1/models", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Could not load OpenCode Zen models. Retry or enter a model ID manually.");
    const body = await response.json() as { data?: Array<{ id?: unknown; name?: unknown }> };
    if (!Array.isArray(body.data)) throw new Error("OpenCode Zen returned an invalid model catalog.");
    const models = body.data.flatMap((model) => {
      if (typeof model.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model.id)) return [];
      return [{
        id: `opencode/${model.id}`,
        label: typeof model.name === "string" && model.name.trim() ? model.name : model.id,
      }];
    }).sort((a, b) => a.label.localeCompare(b.label));
    cached = { until: Date.now() + 60_000, models };
    return models;
  })();
  try { return await pending; } finally { pending = undefined; }
}
