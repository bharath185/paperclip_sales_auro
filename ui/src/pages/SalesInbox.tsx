import { useState, useEffect } from "react";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  salesApi,
  type CampaignRecordDto,
  type LeadApprovalBatchDto,
  type HotLeadEventDto,
  type LeadRecordDto,
} from "@/api/sales";
import {
  Inbox,
  CheckSquare,
  Flame,
  Mail,
  UserCheck,
  Check,
  Building2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Eye,
  Send,
  AlertCircle,
} from "lucide-react";
import { EmailSequenceEditor } from "@/components/EmailSequenceEditor";

export function SalesInbox() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId || "comp-auro-001";
  const { setBreadcrumbs } = useBreadcrumbs();

  const [activeTab, setActiveTab] = useState<"pending" | "sequences" | "hot_leads" | "history">("pending");
  const [campaigns, setCampaigns] = useState<CampaignRecordDto[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [batches, setBatches] = useState<LeadApprovalBatchDto[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLeadEventDto[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);
  const [previewLead, setPreviewLead] = useState<LeadRecordDto | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Sales Hub", href: "/sales" },
      { label: "Approvals & Inbox" },
    ]);
  }, [setBreadcrumbs]);

  const loadData = async () => {
    setLoading(true);
    try {
      const campList = await salesApi.listCampaigns(companyId);
      const safeCamps = Array.isArray(campList) ? campList : [];
      setCampaigns(safeCamps);

      const activeCampId = selectedCampaignId || safeCamps[0]?.id || "";
      if (activeCampId) {
        setSelectedCampaignId(activeCampId);
        const batchList = await salesApi.listApprovalBatches(companyId, activeCampId);
        const safeBatches = Array.isArray(batchList) ? batchList : [];
        setBatches(safeBatches);

        const initialMap: Record<string, Set<string>> = {};
        safeBatches.forEach((b) => {
          if (b.status === "pending" && Array.isArray(b.leads)) {
            initialMap[b.id] = new Set(b.leads.map((l) => l.id));
          }
        });
        setSelectedLeadIds(initialMap);
      }

      const hotList = await salesApi.listHotLeads(companyId);
      setHotLeads(Array.isArray(hotList) ? hotList : []);
    } catch (err) {
      console.error("Failed to load sales inbox data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId, selectedCampaignId]);

  const toggleLeadSelection = (batchId: string, leadId: string) => {
    setSelectedLeadIds((prev) => {
      const currentSet = new Set(prev[batchId] || []);
      if (currentSet.has(leadId)) {
        currentSet.delete(leadId);
      } else {
        currentSet.add(leadId);
      }
      return { ...prev, [batchId]: currentSet };
    });
  };

  const toggleSelectAll = (batchId: string, allIds: string[]) => {
    setSelectedLeadIds((prev) => {
      const currentSet = prev[batchId] || new Set();
      if (currentSet.size === allIds.length) {
        return { ...prev, [batchId]: new Set() };
      } else {
        return { ...prev, [batchId]: new Set(allIds) };
      }
    });
  };

  const handleApproveBatch = async (batchId: string) => {
    if (!selectedCampaignId) return;
    setProcessingBatchId(batchId);
    try {
      const approvedIds = Array.from(selectedLeadIds[batchId] || []);
      await salesApi.approveBatch(companyId, selectedCampaignId, batchId, approvedIds);
      await loadData();
    } catch (err) {
      console.error("Batch approval failed", err);
    } finally {
      setProcessingBatchId(null);
    }
  };

  const safeBatches = Array.isArray(batches) ? batches : [];
  const pendingBatches = safeBatches.filter((b) => b.status === "pending");
  const approvedBatches = safeBatches.filter((b) => b.status === "approved" || b.status === "partially_approved");
  const totalPendingLeads = pendingBatches.reduce((acc, b) => acc + (Array.isArray(b.leads) ? b.leads.length : 0), 0);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Sales Approvals &amp; Outreach Inbox</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Human-in-the-loop review for prospect batches, email sequence verification, and hot reply triage.
          </p>
        </div>

        {campaigns.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Campaign:</span>
            <select
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        <Button
          variant={activeTab === "pending" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => setActiveTab("pending")}
        >
          <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Pending Approvals ({totalPendingLeads})
        </Button>

        <Button
          variant={activeTab === "sequences" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => setActiveTab("sequences")}
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Draft Email Sequences
        </Button>

        <Button
          variant={activeTab === "hot_leads" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => setActiveTab("hot_leads")}
        >
          <Flame className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Hot Inbound Replies ({hotLeads.length})
        </Button>

        <Button
          variant={activeTab === "history" ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8"
          onClick={() => setActiveTab("history")}
        >
          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
          Approval History ({approvedBatches.length})
        </Button>
      </div>

      {/* 1. Pending Approvals Tab */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {loading ? (
            <Card className="border-border bg-card p-8 text-center text-xs text-muted-foreground">
              Loading pending prospect review batches...
            </Card>
          ) : pendingBatches.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center space-y-3">
              <CheckSquare className="h-10 w-10 text-primary mx-auto opacity-60" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Inbox is Zero — All Leads Approved</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  No lead batches are currently awaiting board review. As Researcher agents discover new decision makers, they will populate here for one-click approval.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={loadData} className="text-xs">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Check for New Leads
              </Button>
            </Card>
          ) : (
            pendingBatches.map((batch) => {
              const selected = selectedLeadIds[batch.id] || new Set();
              const safeLeads = Array.isArray(batch.leads) ? batch.leads : [];
              const allLeadIds = safeLeads.map((l) => l.id);
              const isAllSelected = selected.size === allLeadIds.length && allLeadIds.length > 0;

              return (
                <Card key={batch.id} className="border-border bg-card">
                  <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">
                          Outbound Prospect Batch ({safeLeads.length} Decision Makers)
                        </CardTitle>
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 text-xs">
                          Pending Human Gate
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground">
                        Discovered by Autonomous Researcher Agents • Verified against CAN-SPAM and suppression list
                      </CardDescription>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => toggleSelectAll(batch.id, allLeadIds)}
                    >
                      {isAllSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {safeLeads.map((lead) => {
                        const isChecked = selected.has(lead.id);

                        return (
                          <div
                            key={lead.id}
                            className={`p-3 flex items-start gap-3 hover:bg-muted/20 transition-colors cursor-pointer ${
                              isChecked ? "bg-primary/5" : "opacity-60"
                            }`}
                            onClick={() => toggleLeadSelection(batch.id, lead.id)}
                          >
                            <button
                              type="button"
                              className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                                isChecked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-background"
                              }`}
                              aria-label={isChecked ? "Deselect lead" : "Select lead"}
                            >
                              {isChecked && <Check className="h-3 w-3" />}
                            </button>

                            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  {lead.companyName}
                                  <Badge variant="outline" className="text-(length:--text-nano) px-1 py-0 font-normal">
                                    {lead.subSegment || lead.industry}
                                  </Badge>
                                </div>
                                <div className="text-muted-foreground text-xs">{lead.companyDomain}</div>
                              </div>

                              <div>
                                <div className="font-medium text-foreground">{lead.contactName || "Decision Maker"}</div>
                                <div className="text-muted-foreground text-xs">{lead.contactTitle || "Director / VP"}</div>
                                <div className="text-primary truncate">{lead.contactEmail}</div>
                              </div>

                              <div className="sm:text-right flex sm:flex-col justify-between sm:items-end items-center">
                                <Badge
                                  variant="secondary"
                                  className={
                                    (lead.leadScore ?? 0) >= 80
                                      ? "bg-primary/20 text-primary border-primary/30"
                                      : "bg-muted text-muted-foreground"
                                  }
                                >
                                  Score: {lead.leadScore ?? 0}/100
                                </Badge>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewLead(lead);
                                  }}
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                >
                                  <Eye className="h-3 w-3" /> Preview Draft
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 bg-muted/20 border-t border-border flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{selected.size}</span> of {safeLeads.length} leads approved for sequence dispatch
                    </div>

                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => handleApproveBatch(batch.id)}
                      disabled={processingBatchId === batch.id || selected.size === 0}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {processingBatchId === batch.id ? "Enqueuing..." : `Approve & Dispatch (${selected.size})`}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* 2. Draft Sequences Tab */}
      {activeTab === "sequences" && (
        <EmailSequenceEditor
          companyId={companyId}
          campaignId={selectedCampaignId || "camp-default"}
        />
      )}

      {/* 3. Hot Leads Tab */}
      {activeTab === "hot_leads" && (
        <div className="space-y-3">
          {hotLeads.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center space-y-2">
              <Flame className="h-8 w-8 text-primary mx-auto opacity-50" />
              <p className="text-sm font-semibold text-foreground">No Hot Inbound Replies Yet</p>
              <p className="text-xs text-muted-foreground">
                When prospects respond with meeting availability or high interest, they appear here instantly.
              </p>
            </Card>
          ) : (
            hotLeads.map((hl) => (
              <Card key={hl.id} className="border-border bg-card">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-bold text-foreground">{hl.companyName}</CardTitle>
                      <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                        {hl.sentiment === "meeting_requested" ? "📅 Meeting Requested" : "🔥 High Interest"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Contact: <span className="text-foreground font-medium">{hl.contactName}</span> ({hl.contactEmail})
                    </CardDescription>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(hl.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs italic text-foreground/90">
                    "{hl.replySnippet}"
                  </div>

                  <div className="flex justify-between items-center pt-1 text-xs">
                    <span className="text-muted-foreground">Follow-up agent auto-notified human sales rep</span>
                    <a
                      href={`mailto:${hl.contactEmail}?subject=Re:%20Introductory%20Discussion`}
                      className="inline-flex"
                    >
                      <Button size="sm" className="h-7 text-xs">
                        <Mail className="mr-1.5 h-3.5 w-3.5" /> Reply to Prospect
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 4. History Tab */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {approvedBatches.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center text-xs text-muted-foreground">
              No historical approved batches found.
            </Card>
          ) : (
            approvedBatches.map((b) => (
              <Card key={b.id} className="border-border bg-card p-4">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-foreground">Batch #{b.batchNumber} — {b.leads?.length ?? 0} Prospects</div>
                    <div className="text-muted-foreground">Approved {b.approvedAt ? new Date(b.approvedAt).toLocaleString() : "Recently"}</div>
                  </div>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                    Approved &amp; Enqueued ({b.approvedCount ?? b.leads?.length ?? 0})
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal Draft Email Preview */}
      {previewLead && (
        <Card className="border-primary/40 bg-card p-4 space-y-3">
          <div className="flex justify-between items-start border-b border-border pb-2">
            <div>
              <div className="text-xs font-semibold text-primary">Outbound Cold Email Preview (Touch 1)</div>
              <div className="text-sm font-bold text-foreground">To: {previewLead.contactName || "Decision Maker"} ({previewLead.contactEmail})</div>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPreviewLead(null)}>
              Close
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="rounded border border-border bg-muted/20 p-2.5 space-y-1.5">
              <div className="font-semibold text-foreground">
                Subject: Question regarding {previewLead.companyName}'s {previewLead.subSegment || previewLead.industry} operations
              </div>
              <div className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {`Hi ${previewLead.contactName || "there"},

I noticed ${previewLead.companyName}'s recent work in ${previewLead.subSegment || previewLead.industry} across the ${previewLead.locationCity || "Bengaluru"} corridor.

We help precision engineering and manufacturing leaders accelerate component turnaround times by 40% while maintaining strict compliance.

Would you be open to a brief 10-minute introductory conversation next Tuesday or Thursday?`}
              </div>
              <div className="pt-2 border-t border-border/60 text-(length:--text-micro) text-muted-foreground space-y-0.5">
                <div>Sender: Sales Lead • Project Auro Inc. • 100 Innovation Blvd, Tech Park</div>
                <div className="text-primary/80">List-Unsubscribe: &lt;https://api.auro.ai/opt-out&gt; (One-Click RFC 8058)</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
