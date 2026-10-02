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
      setBatches(data);
      // Initialize all leads in pending batches as selected by default
      const initialMap: Record<string, Set<string>> = {};
      data.forEach((b) => {
        if (b.status === "pending") {
          initialMap[b.id] = new Set(b.leads.map((l) => l.id));
        }
      });
      setSelectedLeadIds(initialMap);
    } catch (err) {
      console.error("Failed to load approval batches", err);
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

  const pendingBatches = batches.filter((b) => b.status === "pending");

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
          const allLeadIds = batch.leads.map((l) => l.id);
          const isAllSelected = selected.size === allLeadIds.length && allLeadIds.length > 0;

          return (
            <Card key={batch.id} className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">
                      Research Batch ({batch.leads.length} Leads)
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
                  {batch.leads.map((lead) => {
                    const isChecked = selected.has(lead.id);
                    return (
                      <div
                        key={lead.id}
                        className={`p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer ${
                          isChecked ? "bg-accent/10" : ""
                        }`}
                        onClick={() => toggleLeadSelection(batch.id, lead.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleLeadSelection(batch.id, lead.id)}
                            className="h-4 w-4 rounded border-border"
                          />

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs text-foreground">{lead.companyName}</span>
                              <span className="text-xs text-muted-foreground">• {lead.companyDomain}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {lead.contactName || "Decision Maker"} ({lead.contactTitle || "Executive"}) —{" "}
                              {lead.contactEmail}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              lead.leadScore >= 80
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            Score {lead.leadScore}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {selected.size} of {batch.leads.length} leads selected for outreach
                </span>

                <Button
                  size="sm"
                  disabled={selected.size === 0 || processingBatchId === batch.id}
                  onClick={() => handleApproveBatch(batch.id)}
                >
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                  Approve &amp; Schedule Sequence ({selected.size})
                </Button>
              </CardFooter>
            </Card>
          );
        })
      )}
    </div>
  );
}
