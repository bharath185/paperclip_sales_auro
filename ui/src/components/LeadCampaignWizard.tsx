import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi, type LeadCampaignBriefPayload, type CampaignRecordDto } from "@/api/sales";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight, ShieldCheck, Mail, Users, Target, Database } from "lucide-react";

interface LeadCampaignWizardProps {
  companyId: string;
  onSuccess?: (campaign: CampaignRecordDto) => void;
  onCancel?: () => void;
}

export const BENGALURU_SUB_SEGMENTS = [
  "Auto Components & Powertrain",
  "Aerospace Precision Machining",
  "Machine Tools & Tooling Dies",
  "Packaging Automation Machinery",
  "Industrial Hydraulics & Valves",
  "Sheet Metal & Stamping Assemblies",
  "Heavy Engineering & Fabrication",
];

export function LeadCampaignWizard({
  companyId,
  onSuccess,
  onCancel,
}: LeadCampaignWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState<LeadCampaignBriefPayload>({
    name: "Bengaluru Precision Manufacturing Outbound Q4",
    industry: "Manufacturing",
    subSegment: "Auto Components & Powertrain",
    location: "Bengaluru, Karnataka, India",
    companySize: "50-250",
    targetTitles: [
      "VP of Manufacturing Operations",
      "Plant Head",
      "Director of Engineering",
      "Head of Tooling & Production",
    ],
    offerProposition:
      "Autonomous quality inspection & precision workflow automation cutting tooling cycle times by 35% with full AS9100/ISO traceability.",
    dailyLeadQuota: 20,
    weeklyLeadQuota: 100,
    researcherInstances: 2,
    isDemo: true,
    complianceSettings: {
      dryRunDefault: true,
      requireHumanApproval: true,
      postalAddress: "Project Auro Inc, Peenya Industrial Area, Bengaluru, Karnataka 560058, India",
      dailyLimit: 20,
    },
    crmConfig: {
      provider: "hubspot",
      isMock: true,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignRecordDto | null>(null);

  const updateField = (field: keyof LeadCampaignBriefPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const updateCompliance = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      complianceSettings: {
        ...prev.complianceSettings!,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (!formData.industry.trim() || !formData.location.trim()) {
      setError("Industry and Location are required.");
      return;
    }
    if (!formData.offerProposition.trim()) {
      setError("Offer and value proposition is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await salesApi.createCampaign(companyId, formData);
      setResult(response);
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead campaign.");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-6 w-6" />
            <CardTitle className="text-xl font-semibold">Lead Campaign Activated</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            The CEO Agent has accepted the campaign brief and scheduled the Sales Manager & Researchers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">{result.name}</span>
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                {result.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{result.brief.offerProposition}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-xs text-muted-foreground">
              <div><span className="font-semibold">Target:</span> {result.brief.subSegment}</div>
              <div><span className="font-semibold">Location:</span> {result.brief.location}</div>
              <div><span className="font-semibold">Researchers:</span> {result.brief.researcherInstances} agents</div>
              <div><span className="font-semibold">Daily Quota:</span> {result.brief.dailyLeadQuota} leads</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-accent/30 border border-accent flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Compliance Safeguards Enforced</p>
              <p>• Human batch approval enabled before outbound email queue dispatch.</p>
              <p>• Dry-run mode active by default with statutory postal address & SHA-256 suppression.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setResult(null)}>
            Create Another Campaign
          </Button>
          <Button onClick={() => onSuccess && onSuccess(result)}>
            Proceed to Lead Center <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Lead Generation Campaign Wizard</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  step === i ? "bg-primary" : step > i ? "bg-primary/40" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
        <CardDescription className="text-muted-foreground">
          {step === 1 && "Step 1: Campaign Brief & Geographic Focus"}
          {step === 2 && "Step 2: Sub-segments & Decision-Maker Profiles"}
          {step === 3 && "Step 3: Value Proposition & Quotas"}
          {step === 4 && "Step 4: Statutory Compliance & CRM Sync"}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g., Bengaluru CNC Precision Outbound"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => updateField("industry", e.target.value)}
                    placeholder="e.g., Manufacturing"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Target Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="e.g., Bengaluru, Karnataka, India"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size Range</Label>
                <Input
                  id="companySize"
                  value={formData.companySize || ""}
                  onChange={(e) => updateField("companySize", e.target.value)}
                  placeholder="e.g., 50-250 employees"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sub-segment Focus (Select or Enter Custom)</Label>
                <div className="flex flex-wrap gap-2">
                  {BENGALURU_SUB_SEGMENTS.map((seg) => (
                    <Badge
                      key={seg}
                      variant="outline"
                      className={`cursor-pointer transition-colors ${
                        formData.subSegment === seg
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                      onClick={() => updateField("subSegment", seg)}
                    >
                      {seg}
                    </Badge>
                  ))}
                </div>
                <Input
                  className="mt-2"
                  value={formData.subSegment || ""}
                  onChange={(e) => updateField("subSegment", e.target.value)}
                  placeholder="Custom sub-segment specification"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetTitles">Target Decision-Maker Titles (Comma separated)</Label>
                <Textarea
                  id="targetTitles"
                  rows={3}
                  value={formData.targetTitles.join(", ")}
                  onChange={(e) =>
                    updateField(
                      "targetTitles",
                      e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                    )
                  }
                  placeholder="VP of Manufacturing Operations, Plant Head, Director of Engineering"
                />
                <span className="text-xs text-muted-foreground">
                  AI Researcher Agents will specifically filter public executive directories and leadership pages for these roles.
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="offerProposition">Our Value Proposition & Core Offer</Label>
                <Textarea
                  id="offerProposition"
                  rows={4}
                  value={formData.offerProposition}
                  onChange={(e) => updateField("offerProposition", e.target.value)}
                  placeholder="Describe your solution's key metric, proof point, and differentiator..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyQuota">Daily Lead Quota</Label>
                  <Input
                    id="dailyQuota"
                    type="number"
                    min={5}
                    max={100}
                    value={formData.dailyLeadQuota}
                    onChange={(e) => updateField("dailyLeadQuota", parseInt(e.target.value, 10) || 20)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weeklyQuota">Weekly Lead Quota</Label>
                  <Input
                    id="weeklyQuota"
                    type="number"
                    min={20}
                    max={500}
                    value={formData.weeklyLeadQuota}
                    onChange={(e) => updateField("weeklyLeadQuota", parseInt(e.target.value, 10) || 100)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="researcherCount">Researcher Agents (1-3)</Label>
                  <Input
                    id="researcherCount"
                    type="number"
                    min={1}
                    max={3}
                    value={formData.researcherInstances}
                    onChange={(e) => updateField("researcherInstances", parseInt(e.target.value, 10) || 2)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="postalAddress">Physical Postal Address (DPDP / CAN-SPAM Mandatory Footer)</Label>
                <Input
                  id="postalAddress"
                  value={formData.complianceSettings?.postalAddress}
                  onChange={(e) => updateCompliance("postalAddress", e.target.value)}
                  required
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Require Human Batch Approval</Label>
                    <p className="text-xs text-muted-foreground">
                      Holds discovered leads in review status before sequences are scheduled.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={formData.complianceSettings?.requireHumanApproval}
                    onChange={(e) => updateCompliance("requireHumanApproval", e.target.checked)}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Deliverability Dry-Run Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Simulates sequence generation and delivery without firing live SMTP sockets.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={formData.complianceSettings?.dryRunDefault}
                    onChange={(e) => updateCompliance("dryRunDefault", e.target.checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="crmProvider">CRM Integration Target</Label>
                <select
                  id="crmProvider"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  value={formData.crmConfig?.provider}
                  onChange={(e) =>
                    updateField("crmConfig", {
                      ...formData.crmConfig,
                      provider: e.target.value as any,
                      isMock: true,
                    })
                  }
                >
                  <option value="hubspot">HubSpot CRM (Mock / API v3)</option>
                  <option value="generic_webhook">Generic REST Webhook</option>
                  <option value="csv_export">CSV File Export</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between items-center border-t border-border pt-4">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as any)}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {step < 4 ? (
            <Button type="button" onClick={() => setStep((s) => (s + 1) as any)}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Launch Sales Campaign
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
