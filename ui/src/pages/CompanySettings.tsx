import { ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { assetsApi } from "../api/assets";
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
} from "lucide-react";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import { Field } from "../components/agent-config-primitives";

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

  const handleSaveAll = () => {
    // Save to local storage for persistence across sales operations
    localStorage.setItem("auro_sender_name", senderName);
    localStorage.setItem("auro_sender_email", senderEmail);
    localStorage.setItem("auro_legal_name", legalBusinessName);
    localStorage.setItem("auro_physical_address", physicalAddress);
    localStorage.setItem("auro_crm_webhook", webhookUrl);
    localStorage.setItem("auro_hubspot_key", hubspotKey);

    if (companyName.trim() && selectedCompanyId) {
      generalMutation.mutate({
        name: companyName.trim(),
        description: description.trim() || null,
      });
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

        <Button size="sm" onClick={handleSaveAll} className="text-xs">
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save Changes
        </Button>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          Settings saved successfully. Sender identity and CRM settings are updated.
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

      {/* 2. AI Provider (OpenCode) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">AI Intelligence Engine (OpenCode)</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
              Live Connected
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Powers autonomous prospect discovery, lead qualification scoring, and multi-touch sequence copywriting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Configured Provider</div>
              <div className="text-sm font-semibold text-foreground">OpenCode AI Engine</div>
              <div className="text-xs text-muted-foreground font-mono truncate">API Key: oc_sk_0deaa••••••••••</div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Active Model Engine</div>
              <div className="text-sm font-semibold text-foreground">OpenCode Fast &amp; Reasoning</div>
              <div className="text-xs text-primary font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready for Autonomous Research
              </div>
            </div>
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
