import { useState, useEffect } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi, type CampaignRecordDto, type SalesOrgStatus } from "@/api/sales";
import { LeadCampaignWizard } from "@/components/LeadCampaignWizard";
import { LeadCenter } from "@/components/LeadCenter";
import { EmailSequenceEditor } from "@/components/EmailSequenceEditor";
import { SalesApprovalsInbox } from "@/components/SalesApprovalsInbox";
import { HotLeadsView } from "@/components/HotLeadsView";
import { SuppressionManager } from "@/components/SuppressionManager";
import {
  TrendingUp,
  Target,
  Users,
  Mail,
  CheckSquare,
  Flame,
  ShieldCheck,
  Plus,
  Sparkles,
  Building2,
  RefreshCw,
} from "lucide-react";

export function Sales() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId || "comp-auro-001";

  const [activeTab, setActiveTab] = useState<
    "campaigns" | "lead_center" | "sequences" | "approvals" | "hot_leads" | "compliance"
  >("campaigns");

  const [campaigns, setCampaigns] = useState<CampaignRecordDto[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRecordDto | undefined>(undefined);
  const [showWizard, setShowWizard] = useState(false);
  const [orgStatus, setOrgStatus] = useState<SalesOrgStatus | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await salesApi.listCampaigns(companyId);
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0]);
      }
    } catch (err) {
      console.error("Failed to load campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [companyId]);

  const handleProvisionOrg = async () => {
    setProvisioning(true);
    try {
      const res = await salesApi.provisionSalesOrg(companyId);
      setOrgStatus(res);
    } catch (err) {
      console.error("Failed to provision sales org", err);
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Sales &amp; Lead Generation Organization
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Autonomous multi-agent outbound engine with researcher dispatch, lead deduplication, 3-touch sequence generation, and CRM synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleProvisionOrg}
            disabled={provisioning}
            className="text-xs"
          >
            <Sparkles className={`mr-1.5 h-3.5 w-3.5 text-primary ${provisioning ? "animate-spin" : ""}`} />
            {provisioning ? "Provisioning..." : "Provision Sales Org"}
          </Button>

          <Button size="sm" onClick={() => setShowWizard(true)} className="text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Campaign Brief
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        <Button
          variant={activeTab === "campaigns" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            setActiveTab("campaigns");
            setShowWizard(false);
          }}
        >
          <Target className="mr-1.5 h-3.5 w-3.5" /> Campaigns ({campaigns.length})
        </Button>

        <Button
          variant={activeTab === "lead_center" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            setActiveTab("lead_center");
            setShowWizard(false);
          }}
        >
          <Users className="mr-1.5 h-3.5 w-3.5" /> Lead Center
        </Button>

        <Button
          variant={activeTab === "approvals" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            setActiveTab("approvals");
            setShowWizard(false);
          }}
        >
          <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Human Approvals
        </Button>

        <Button
          variant={activeTab === "sequences" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            setActiveTab("sequences");
            setShowWizard(false);
          }}
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" /> 3-Touch Sequences
        </Button>

        <Button
          variant={activeTab === "hot_leads" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            setActiveTab("hot_leads");
            setShowWizard(false);
          }}
        >
          <Flame className="mr-1.5 h-3.5 w-3.5 text-primary" /> Hot Leads
        </Button>

        <Button
          variant={activeTab === "compliance" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            setActiveTab("compliance");
            setShowWizard(false);
          }}
        >
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Privacy &amp; Suppressions
        </Button>
      </div>

      {/* Main Content Area */}
      {showWizard ? (
        <LeadCampaignWizard
          companyId={companyId}
          onSuccess={(camp) => {
            setShowWizard(false);
            fetchCampaigns();
            setSelectedCampaign(camp);
            setActiveTab("lead_center");
          }}
          onCancel={() => setShowWizard(false)}
        />
      ) : activeTab === "campaigns" ? (
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center space-y-3">
              <Target className="h-10 w-10 text-muted-foreground mx-auto opacity-60" />
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">No Outbound Campaigns Active</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Scaffold your first lead campaign targeting specific industrial corridors like Bengaluru manufacturing, auto components, or tooling machinery.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowWizard(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Create First Campaign
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <Card
                  key={camp.id}
                  className={`border-border bg-card hover:border-primary/50 transition-colors cursor-pointer ${
                    selectedCampaign?.id === camp.id ? "ring-1 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedCampaign(camp)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm font-semibold text-foreground">{camp.name}</CardTitle>
                      <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                        {camp.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      {camp.brief.industry} • {camp.brief.subSegment || "General"} • {camp.brief.location}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{camp.brief.offerProposition}</p>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-base font-bold text-foreground">{camp.stats.totalLeadsFound}</div>
                        <div className="text-xs text-muted-foreground">Leads Found</div>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-base font-bold text-primary">{camp.stats.leadsApproved}</div>
                        <div className="text-xs text-muted-foreground">Approved</div>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-base font-bold text-foreground">{camp.stats.crmSyncedCount}</div>
                        <div className="text-xs text-muted-foreground">CRM Synced</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "lead_center" ? (
        <LeadCenter companyId={companyId} campaign={selectedCampaign} />
      ) : activeTab === "approvals" ? (
        <SalesApprovalsInbox companyId={companyId} campaign={selectedCampaign} onBatchApproved={fetchCampaigns} />
      ) : activeTab === "sequences" ? (
        <EmailSequenceEditor companyId={companyId} campaignId={selectedCampaign?.id || "camp-default"} />
      ) : activeTab === "hot_leads" ? (
        <HotLeadsView companyId={companyId} />
      ) : (
        <SuppressionManager companyId={companyId} />
      )}
    </div>
  );
}
