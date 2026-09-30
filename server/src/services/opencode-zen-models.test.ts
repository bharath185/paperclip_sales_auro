import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("lists and caches the public OpenCode Zen catalog without sending credentials", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
    { id: "gpt-6-luna" }, { id: "claude-sonnet-5", name: "Claude Sonnet 5" }, { id: "bad/model" }, { id: 42 },
  ] }) });
  vi.stubGlobal("fetch", fetch);
  const { listOpenCodeZenModels } = await import("./opencode-zen-models.js");
  expect(await listOpenCodeZenModels()).toEqual([
    { id: "opencode/claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "opencode/gpt-6-luna", label: "gpt-6-luna" },
  ]);
  await listOpenCodeZenModels();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("https://opencode.ai/zen/v1/models", { signal: expect.any(AbortSignal) });
});

it("allows retry after a public catalog failure", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
  vi.stubGlobal("fetch", fetch);
  const { listOpenCodeZenModels } = await import("./opencode-zen-models.js");
  await expect(listOpenCodeZenModels()).rejects.toThrow("Retry or enter a model ID manually");
  await expect(listOpenCodeZenModels()).resolves.toEqual([]);
});
