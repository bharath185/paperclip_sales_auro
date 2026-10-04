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
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Sales Approvals &amp; Outreach Inbox</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Human-in-the-loop review for prospect batches, verified corporate profiles, and hot reply triage.
              </p>
            </div>
          </div>
        </div>

        {campaigns.length > 1 && (
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">Campaign:</span>
            <select
              className="rounded bg-background px-2.5 py-1 text-xs text-foreground font-medium outline-none border border-input cursor-pointer"
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
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button
          variant={activeTab === "pending" ? "default" : "outline"}
          size="sm"
          className="text-xs font-medium h-9"
          onClick={() => setActiveTab("pending")}
        >
          <CheckSquare className="mr-1.5 h-4 w-4" />
          Pending Approvals ({totalPendingLeads})
        </Button>

        <Button
          variant={activeTab === "sequences" ? "default" : "outline"}
          size="sm"
          className="text-xs font-medium h-9"
          onClick={() => setActiveTab("sequences")}
        >
          <Mail className="mr-1.5 h-4 w-4" />
          Email Sequence Templates
        </Button>

        <Button
          variant={activeTab === "hot_leads" ? "default" : "outline"}
          size="sm"
          className="text-xs font-medium h-9"
          onClick={() => setActiveTab("hot_leads")}
        >
          <Flame className="mr-1.5 h-4 w-4 text-amber-500" />
          Hot Inbound Replies ({hotLeads.length})
        </Button>

        <Button
          variant={activeTab === "history" ? "default" : "outline"}
          size="sm"
          className="text-xs font-medium h-9"
          onClick={() => setActiveTab("history")}
        >
          <UserCheck className="mr-1.5 h-4 w-4" />
          Approval History ({approvedBatches.length})
        </Button>
      </div>

      {/* 1. Pending Approvals Tab */}
      {activeTab === "pending" && (
        <div className="space-y-6">
          {loading ? (
            <Card className="border-border bg-card p-12 text-center text-sm text-muted-foreground">
              Loading pending prospect review batches...
            </Card>
          ) : pendingBatches.length === 0 ? (
            <Card className="border-border bg-card p-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <CheckSquare className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Inbox is Clear — All Leads Approved</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  No lead batches are currently awaiting review. New verified enterprise accounts discovered by your AI Researchers will populate here.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={loadData} className="text-xs">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh Inbox
              </Button>
            </Card>
          ) : (
            pendingBatches.map((batch) => {
              const selected = selectedLeadIds[batch.id] || new Set();
              const safeLeads = Array.isArray(batch.leads) ? batch.leads : [];
              const allLeadIds = safeLeads.map((l) => l.id);
              const isAllSelected = selected.size === allLeadIds.length && allLeadIds.length > 0;

              return (
                <Card key={batch.id} className="border-border bg-card shadow-sm overflow-hidden">
                  <CardHeader className="p-4 bg-muted/30 border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <CardTitle className="text-base font-bold text-foreground">
                          Outbound Prospect Review Batch
                        </CardTitle>
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 text-xs font-semibold px-2 py-0.5">
                          {safeLeads.length} Accounts Awaiting Review
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Verified manufacturing entities • Internal database storage mode • Outbound dispatch guarded
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-medium"
                        onClick={() => toggleSelectAll(batch.id, allLeadIds)}
                      >
                        {isAllSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {safeLeads.map((lead) => {
                        const isChecked = selected.has(lead.id);

                        return (
                          <div
                            key={lead.id}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                              isChecked
                                ? "bg-card border-primary shadow-xs ring-1 ring-primary/20"
                                : "bg-muted/10 border-border opacity-60 hover:opacity-100"
                            }`}
                            onClick={() => toggleLeadSelection(batch.id, lead.id)}
                          >
                            <div className="space-y-2">
                              {/* Top Bar: Company Name & Selection Checkbox */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-foreground truncate">{lead.companyName}</h3>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="truncate">{lead.companyDomain || (lead as any).domain || "domain.com"}</span>
                                    {((lead as any).website || lead.companyDomain) && (
                                      <a
                                        href={(lead as any).website || `https://${lead.companyDomain}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Visit <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant="secondary"
                                    className={
                                      (lead.leadScore ?? (lead as any).score ?? 0) >= 80
                                        ? "bg-primary/20 text-primary border-primary/30 text-xs font-bold"
                                        : "bg-muted text-muted-foreground text-xs"
                                    }
                                  >
                                    Score: {lead.leadScore ?? (lead as any).score ?? 0}/100
                                  </Badge>

                                  <button
                                    type="button"
                                    className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                                      isChecked
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground/40 bg-background"
                                    }`}
                                    aria-label={isChecked ? "Deselect lead" : "Select lead"}
                                  >
                                    {isChecked && <Check className="h-3.5 w-3.5 " />}
                                  </button>
                                </div>
                              </div>

                              {/* Badges: Sub-segment & Location */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <Badge variant="outline" className="text-xs bg-muted/30 font-normal">
                                  {lead.subSegment || lead.industry}
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-muted/30 font-normal text-muted-foreground">
                                  📍 {lead.locationCity || (lead as any).location || "Bengaluru Industrial Corridor"}
                                </Badge>
                              </div>

                              {/* Decision Maker Details */}
                              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1">
                                <div className="font-semibold text-foreground flex items-center justify-between">
                                  <span>👤 {lead.contactName || (lead as any).decisionMakerName || "Executive Decision Maker"}</span>
                                  <span className="text-xs text-muted-foreground font-normal">{lead.contactTitle || (lead as any).decisionMakerTitle || "Leadership"}</span>
                                </div>
                                <div className="text-primary truncate font-mono text-xs">{lead.contactEmail || (lead as any).email || "contact@domain.com"}</div>
                                {(lead as any).phone && (
                                  <div className="text-muted-foreground text-xs">📞 {(lead as any).phone}</div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {isChecked ? "✓ Selected for database" : "Click to select"}
                              </span>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewLead(lead);
                                }}
                              >
                                <Eye className="mr-1 h-3 w-3" /> Preview Outreach Draft
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 bg-muted/30 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      Selected <span className="font-bold text-foreground text-sm">{selected.size}</span> of {safeLeads.length} verified accounts to save &amp; approve
                    </div>

                    <Button
                      size="sm"
                      className="text-xs font-bold px-5 h-9"
                      onClick={() => handleApproveBatch(batch.id)}
                      disabled={processingBatchId === batch.id || selected.size === 0}
                    >
                      <Check className="mr-1.5 h-4 w-4 " />
                      {processingBatchId === batch.id ? "Saving to Database..." : `Approve & Save to Database (${selected.size})`}
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
        <div className="space-y-4">
          {hotLeads.length === 0 ? (
            <Card className="border-border bg-card p-12 text-center space-y-3">
              <Flame className="h-10 w-10 text-primary mx-auto opacity-50" />
              <p className="text-base font-semibold text-foreground">No Hot Inbound Replies Yet</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                When prospects respond with meeting requests or technical inquiries, they will appear here instantly.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hotLeads.map((hl) => (
                <Card key={hl.id} className="border-border bg-card p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{hl.companyName}</h3>
                        <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">
                          {hl.sentiment === "meeting_requested" ? "📅 Meeting Requested" : "🔥 High Interest"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Contact: <span className="font-medium text-foreground">{hl.contactName}</span> ({hl.contactEmail})
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(hl.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs italic text-foreground leading-relaxed">
                    "{hl.replySnippet}"
                  </div>

                  <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Autonomous follow-up notification captured</span>
                    <a href={`mailto:${hl.contactEmail}?subject=Re:%20Introductory%20Discussion`} className="inline-flex">
                      <Button size="sm" className="h-7 text-xs">
                        <Mail className="mr-1.5 h-3.5 w-3.5" /> Reply to Prospect
                      </Button>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
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
                    <div className="font-semibold text-foreground">Batch #{b.batchNumber || b.id.slice(0, 8)} — {b.leads?.length ?? 0} Accounts</div>
                    <div className="text-muted-foreground">Approved &amp; saved into internal database</div>
                  </div>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold">
                    ✓ Approved ({b.approvedCount ?? b.leads?.length ?? 0})
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal Draft Email Preview */}
      {previewLead && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border-primary/40 bg-card shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <Badge variant="secondary" className="bg-primary/20 text-primary text-xs font-bold mb-1">
                  Outbound Cold Email Preview (Touch 1)
                </Badge>
                <h3 className="text-base font-bold text-foreground">
                  To: {previewLead.contactName || (previewLead as any).decisionMakerName || "Executive"} ({previewLead.contactEmail || (previewLead as any).email})
                </h3>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setPreviewLead(null)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <div className="font-bold text-foreground text-sm">
                  Subject: Question regarding {previewLead.companyName}'s {previewLead.subSegment || previewLead.industry} operations
                </div>
                <div className="text-muted-foreground whitespace-pre-line leading-relaxed text-xs">
                  {`Hi ${previewLead.contactName || (previewLead as any).decisionMakerName || "there"},

I noticed ${previewLead.companyName}'s recent manufacturing work in ${previewLead.subSegment || previewLead.industry} across the ${previewLead.locationCity || (previewLead as any).location || "Bengaluru"} corridor.

We help precision engineering and plant leaders accelerate project turnaround times by 40% while maintaining 100% component traceability and quality governance.

Would you be open to a brief 10-minute introductory conversation next Tuesday or Thursday?

Best regards,
Auro Sales Lead
Project Auro Inc.`}
                </div>
                <div className="pt-3 border-t border-border/60 text-(length:--text-nano) text-muted-foreground space-y-0.5">
                  <div>Internal Storage: Saved in Database • Physical Address: Industrial Corridor, Bengaluru</div>
                  <div className="text-primary/80">List-Unsubscribe: &lt;https://api.auro.ai/opt-out&gt; (One-Click RFC 8058)</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setPreviewLead(null)} className="text-xs">
                Close Preview
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
