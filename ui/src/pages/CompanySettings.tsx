import { ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { assetsApi } from "../api/assets";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SlidersHorizontal,
  Mail,
  ShieldCheck,
  Building2,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Save,
  Cpu,
  Bot,
  Zap,
} from "lucide-react";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import { Field } from "../components/agent-config-primitives";

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast & High Intelligence - Recommended)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep Reasoning & Complex Workflows)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Ultra-Low Latency)" },
];

const OPENCODE_MODELS = [
  { id: "opencode/deepseek-v4-flash", label: "OpenCode DeepSeek V4 Flash (Fast - Recommended)" },
  { id: "opencode/deepseek-v4-reasoning", label: "OpenCode DeepSeek V4 Reasoning (Deep Logic)" },
  { id: "opencode/qwen-2.5-coder-32b", label: "OpenCode Qwen 2.5 Coder (Code & Workflows)" },
];

export function CompanySettings() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Sender identity local state
  const [senderName, setSenderName] = useState(() => localStorage.getItem("auro_sender_name") || "Sales Lead");
  const [senderEmail, setSenderEmail] = useState(() => localStorage.getItem("auro_sender_email") || "sales@auro.ai");
  const [legalBusinessName, setLegalBusinessName] = useState(() => localStorage.getItem("auro_legal_name") || "Auro Outbound Inc.");
  const [physicalAddress, setPhysicalAddress] = useState(() => localStorage.getItem("auro_physical_address") || "100 Innovation Blvd, Suite 200, Tech Park");

  // AI Provider local state
  const [aiProvider, setAiProvider] = useState<"gemini" | "opencode">(() => (localStorage.getItem("auro_ai_provider") as "gemini" | "opencode") || "gemini");
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("auro_gemini_key") || "");
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem("auro_gemini_model") || "gemini-2.5-flash");
  const [openCodeApiKey, setOpenCodeApiKey] = useState(() => localStorage.getItem("auro_opencode_key") || "");
  const [openCodeModel, setOpenCodeModel] = useState(() => localStorage.getItem("auro_opencode_model") || "opencode/deepseek-v4-flash");
  const [applyToAgents, setApplyToAgents] = useState(true);
  const [isUpdatingAgents, setIsUpdatingAgents] = useState(false);

  // CRM settings local state
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem("auro_crm_webhook") || "https://api.hubspot.com/crm/v3/imports");
  const [hubspotKey, setHubspotKey] = useState(() => localStorage.getItem("auro_hubspot_key") || "pat-na1-••••••••••••••••");
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setDescription(selectedCompany.description ?? "");
    setLogoUrl(selectedCompany.logoUrl ?? "");
  }, [selectedCompany]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Sales Hub", href: "/sales" },
      { label: "Settings & Configuration" }
    ]);
  }, [setBreadcrumbs]);

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const syncLogoState = (nextLogoUrl: string | null) => {
    setLogoUrl(nextLogoUrl ?? "");
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
  };

  const logoUploadMutation = useMutation({
    mutationFn: (file: File) =>
      assetsApi
        .uploadCompanyLogo(selectedCompanyId!, file)
        .then((asset) => companiesApi.update(selectedCompanyId!, { logoAssetId: asset.assetId })),
    onSuccess: (company) => {
      syncLogoState(company.logoUrl);
    }
  });

  const handleSaveAll = async () => {
    // Save to local storage for persistence across sales operations
    localStorage.setItem("auro_sender_name", senderName);
    localStorage.setItem("auro_sender_email", senderEmail);
    localStorage.setItem("auro_legal_name", legalBusinessName);
    localStorage.setItem("auro_physical_address", physicalAddress);
    localStorage.setItem("auro_crm_webhook", webhookUrl);
    localStorage.setItem("auro_hubspot_key", hubspotKey);

    localStorage.setItem("auro_ai_provider", aiProvider);
    localStorage.setItem("auro_gemini_key", geminiApiKey);
    localStorage.setItem("auro_gemini_model", geminiModel);
    localStorage.setItem("auro_opencode_key", openCodeApiKey);
    localStorage.setItem("auro_opencode_model", openCodeModel);

    if (companyName.trim() && selectedCompanyId) {
      generalMutation.mutate({
        name: companyName.trim(),
        description: description.trim() || null,
      });
    }

    if (applyToAgents && selectedCompanyId) {
      setIsUpdatingAgents(true);
      try {
        const agents = await agentsApi.list(selectedCompanyId);
        const activeAgents = agents.filter((a) => a.status !== "terminated");
        const targetAdapter = aiProvider === "gemini" ? "gemini_local" : "opencode_local";
        const targetModel = aiProvider === "gemini" ? geminiModel : openCodeModel;
        const targetKey = aiProvider === "gemini" ? geminiApiKey : openCodeApiKey;

        await Promise.allSettled(
          activeAgents.map((agent) =>
            agentsApi.update(
              agent.id,
              {
                adapterType: targetAdapter,
                runtimeConfig: {
                  ...((agent.runtimeConfig as Record<string, unknown>) || {}),
                  model: targetModel,
                  aiConnection: {
                    provider: aiProvider,
                    apiKey: targetKey ? targetKey : undefined,
                  },
                },
              },
              selectedCompanyId
            )
          )
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      } catch (err) {
        console.error("Failed to propagate AI provider settings to agents:", err);
      } finally {
        setIsUpdatingAgents(false);
      }
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No organization selected.
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Sales &amp; Outbound Settings</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure required legal sender identity, AI provider models, and CRM synchronization.
          </p>
        </div>

        <Button size="sm" onClick={handleSaveAll} disabled={isUpdatingAgents} className="text-xs">
          <Save className="mr-1.5 h-3.5 w-3.5" /> {isUpdatingAgents ? "Applying Settings..." : "Save Changes"}
        </Button>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          Settings saved successfully. Sender identity, AI engine ({aiProvider === "gemini" ? "Google Gemini" : "OpenCode"}), and CRM settings updated.
        </div>
      )}

      {/* 1. Sender Identity (Required for Outbound) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Sender Identity &amp; Legal Compliance</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20 text-xs">
              RFC 8058 &amp; CAN-SPAM Required
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            These credentials are automatically rendered in cold email sequence footers with one-click unsubscribe headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Sender Name" hint="Display name of the person sending outbound emails.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </Field>

            <Field label="Sender Email" hint="Verified sending email address or mailbox.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="e.g. john@company.com"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Legal Business Name" hint="Official registered entity name.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                type="text"
                value={legalBusinessName}
                onChange={(e) => setLegalBusinessName(e.target.value)}
                placeholder="e.g. Acme Corp Inc."
              />
            </Field>

            <Field label="Physical Postal Address" hint="Mailing address required for CAN-SPAM compliance.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                type="text"
                value={physicalAddress}
                onChange={(e) => setPhysicalAddress(e.target.value)}
                placeholder="e.g. 100 Tech Park, Suite 400, San Francisco, CA"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 2. AI Provider (Gemini & OpenCode Only) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">AI Intelligence Engine</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20 text-xs">
              Gemini &amp; OpenCode Supported
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Configure the primary AI harness and models for lead qualification, copywriting, and autonomous research.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Gemini Option */}
            <div
              onClick={() => setAiProvider("gemini")}
              className={`cursor-pointer rounded-lg border p-3.5 transition-all flex flex-col justify-between gap-2 ${
                aiProvider === "gemini"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Google Gemini</div>
                    <div className="text-xs text-muted-foreground">Gemini 2.5 Flash / Pro Multimodal</div>
                  </div>
                </div>
                {aiProvider === "gemini" && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                High-speed multimodal intelligence with large context windows for thorough lead analysis.
              </p>
            </div>

            {/* OpenCode Option */}
            <div
              onClick={() => setAiProvider("opencode")}
              className={`cursor-pointer rounded-lg border p-3.5 transition-all flex flex-col justify-between gap-2 ${
                aiProvider === "opencode"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">OpenCode</div>
                    <div className="text-xs text-muted-foreground">OpenRouter / DeepSeek Engine</div>
                  </div>
                </div>
                {aiProvider === "opencode" && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Open-weights and specialized reasoning models for autonomous execution and coding tasks.
              </p>
            </div>
          </div>

          {/* Provider Details Configuration */}
          {aiProvider === "gemini" ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Google Gemini Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Gemini API Key" hint="Your Google AI Studio API key (GEMINI_API_KEY).">
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy••••••••••••••••••••••••"
                  />
                </Field>

                <Field label="Default Model" hint="Recommended model for outbound agent operations.">
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                  >
                    {GEMINI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" /> OpenCode / OpenRouter Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="OpenCode / OpenRouter API Key" hint="Your OpenRouter or OpenCode endpoint API key.">
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                    type="password"
                    value={openCodeApiKey}
                    onChange={(e) => setOpenCodeApiKey(e.target.value)}
                    placeholder="sk-or-v1-••••••••••••••••••••••••"
                  />
                </Field>

                <Field label="Default Model" hint="Model endpoint for OpenCode execution.">
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={openCodeModel}
                    onChange={(e) => setOpenCodeModel(e.target.value)}
                  >
                    {OPENCODE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Sync Option */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="apply-to-agents"
              checked={applyToAgents}
              onChange={(e) => setApplyToAgents(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="apply-to-agents" className="text-xs text-foreground cursor-pointer select-none">
              Automatically apply selected AI provider ({aiProvider === "gemini" ? "Google Gemini" : "OpenCode"}) to all active agents in this organization
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 3. CRM Integrations */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">CRM &amp; Lead Webhooks</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              AES-256 Encrypted
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Automatically export approved leads and hot responses directly to your CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CRM Webhook Endpoint" hint="Webhook URL for pushing leads in real time.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
              />
            </Field>

            <Field label="HubSpot Private App Token" hint="Token used for direct CRM deal and contact sync.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                type="password"
                value={hubspotKey}
                onChange={(e) => setHubspotKey(e.target.value)}
                placeholder="pat-na1-xxxxxxxx-xxxx"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 4. Organization Details */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Organization Profile</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Display name and branding for this sales instance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Organization Name" hint="Display name for this workspace.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </Field>

            <Field label="Description" hint="Workspace purpose.">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Outbound Sales & Growth"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={handleSaveAll} className="text-xs">
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
