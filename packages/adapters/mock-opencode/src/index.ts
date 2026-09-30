export const type = "mock-opencode";
export const label = "OpenCode (Mock)";

export const models: Array<{ id: string; label: string }> = [
  { id: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { id: "openai/gpt-4-turbo", label: "OpenAI GPT-4 Turbo" },
  { id: "openai/gpt-3.5-turbo", label: "OpenAI GPT-3.5 Turbo" },
  { id: "anthropic/claude-3-opus-20240229", label: "Anthropic Claude 3 Opus" },
  { id: "anthropic/claude-3-sonnet-20240229", label: "Anthropic Claude 3 Sonnet" },
  { id: "anthropic/claude-3-haiku-20240307", label: "Anthropic Claude 3 Haiku" },
  { id: "google/gemini-1.5-flash", label: "Google Gemini 1.5 Flash" },
  { id: "google/gemini-1.5-pro", label: "Google Gemini 1.5 Pro" },
  { id: "xai/grok-2-20240513", label: "xAI Grok 2" },
  { id: "meta/llama-3.1-405b", label: "Meta Llama 3.1 405B" },
];

export const agentConfigurationDoc = `# opencode_local agent configuration

Adapter: mock-opencode

Use when:
- You want Paperclip to use a demo OpenCode adapter without a real API key
- You want to test agent runs in isolation without provider costs
- You want to demo OpenCode features without incurring usage charges

Don't use when:
- You need real provider model capabilities
- You need webhook-style external invocation

Core fields:
- model (string, required): OpenCode model id in provider/model format
- variant (string, optional): reasoning/profile variant
- dangerouslySkipPermissions (boolean, optional): auto-approve all tools and connections
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "mock-opencode"
- extraArgs (string[], optional): additional args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- This adapter simulates OpenCode Zen model responses for development and testing
- No real model calls are made; all responses are deterministic fixtures
- Model costs are $0.00 in demo mode
- To use a real OpenCode key, go to Settings > Providers and add your OPENCODE_API_KEY
- A red banner will appear when running in demo mode: "Demo mode: no OpenCode key"
`;