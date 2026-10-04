import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi, type LeadApprovalBatchDto, type CampaignRecordDto } from "@/api/sales";
import { ShieldCheck, CheckSquare, Square, Check, X, AlertCircle, Sparkles, Building2, UserCheck } from "lucide-react";

interface SalesApprovalsInboxProps {
  companyId: string;
  campaign?: CampaignRecordDto;
  onBatchApproved?: () => void;
}

export function SalesApprovalsInbox({
  companyId,
  campaign,
  onBatchApproved,
}: SalesApprovalsInboxProps) {
  const [batches, setBatches] = useState<LeadApprovalBatchDto[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const data = await salesApi.listApprovalBatches(companyId, campaign.id);
      const safeData = Array.isArray(data) ? data : [];
      setBatches(safeData);
      // Initialize all leads in pending batches as selected by default
      const initialMap: Record<string, Set<string>> = {};
      safeData.forEach((b) => {
        if (b.status === "pending" && Array.isArray(b.leads)) {
          initialMap[b.id] = new Set(b.leads.map((l) => l.id));
        }
      });
      setSelectedLeadIds(initialMap);
    } catch (err) {
      console.error("Failed to load approval batches", err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [companyId, campaign?.id]);

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
    if (!campaign?.id) return;
    setProcessingBatchId(batchId);
    try {
      const approvedIds = Array.from(selectedLeadIds[batchId] || []);
      await salesApi.approveBatch(companyId, campaign.id, batchId, approvedIds);
      await fetchBatches();
      if (onBatchApproved) onBatchApproved();
    } catch (err) {
      console.error("Batch approval failed", err);
    } finally {
      setProcessingBatchId(null);
    }
  };

  const safeBatches = Array.isArray(batches) ? batches : [];
  const pendingBatches = safeBatches.filter((b) => b.status === "pending");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Sales Lead Human Approval Gate</h3>
        <p className="text-xs text-muted-foreground">
          Review prospect batches discovered by AI Researchers before they are handed off to the Follow-up Sequence Agent.
        </p>
      </div>

      {loading ? (
        <Card className="border-border bg-card p-8 text-center text-xs text-muted-foreground">
          Loading approval inbox...
        </Card>
      ) : pendingBatches.length === 0 ? (
        <Card className="border-border bg-card p-8 text-center space-y-2">
          <CheckSquare className="h-8 w-8 text-primary mx-auto opacity-70" />
          <p className="text-sm font-medium text-foreground">No Pending Lead Batches</p>
          <p className="text-xs text-muted-foreground">
            All discovered leads have been approved or dispatched into active sequences.
          </p>
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
                      Research Batch ({safeLeads.length} Leads)
                    </CardTitle>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs">
                      Pending Review
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Discovered {new Date(batch.createdAt).toLocaleString()} by AI Researcher Agents
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

                          <div className="sm:text-right">
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
                            <div className="text-muted-foreground text-(length:--text-nano) mt-1">
                              {lead.locationCity || "Bengaluru"}
                            </div>
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
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                  {processingBatchId === batch.id ? "Approving..." : `Approve & Enqueue (${selected.size})`}
                </Button>
              </CardFooter>
            </Card>
          );
        })
      )}
    </div>
  );
}
