const ALLOWED_ADAPTERS = new Set([
  "gemini_local",
  "opencode_local",
]);

/** Creation policy shared by the picker and direct setup links. */
export function isNewAgentAdapterAllowed(
  type: string,
  _options?: { cloud?: boolean; nativeRunnerEnabled?: boolean },
) {
  return ALLOWED_ADAPTERS.has(type);
}
