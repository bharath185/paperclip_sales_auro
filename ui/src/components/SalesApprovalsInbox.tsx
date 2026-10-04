import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi, type LeadApprovalBatchDto, type CampaignRecordDto } from "@/api/sales";
import { CheckSquare, Check, Sparkles, Building2, UserCheck, ExternalLink, MapPin, Mail, Phone, User, ShieldCheck } from "lucide-react";

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
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border border-border">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Sales Lead Human Approval Gate
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review prospect accounts verified by AI Researchers before saving and enqueuing them to your internal database.
          </p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto bg-background text-xs py-1 px-3 border-border">
          Safe Mode Active: Internal DB Only
        </Badge>
      </div>

      {loading ? (
        <Card className="border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Sparkles className="h-6 w-6 text-primary mx-auto animate-spin mb-2" />
          Loading approval batches...
        </Card>
      ) : pendingBatches.length === 0 ? (
        <Card className="border-border bg-card p-12 text-center space-y-3">
          <CheckSquare className="h-10 w-10 text-primary mx-auto opacity-70" />
          <p className="text-base font-semibold text-foreground">No Pending Lead Batches</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All discovered leads have been approved and saved to the database. Dispatch new researcher runs from the Campaigns tab to gather more leads.
          </p>
        </Card>
      ) : (
        pendingBatches.map((batch) => {
          const selected = selectedLeadIds[batch.id] || new Set();
          const safeLeads = Array.isArray(batch.leads) ? batch.leads : [];
          const allLeadIds = safeLeads.map((l) => l.id);
          const isAllSelected = selected.size === allLeadIds.length && allLeadIds.length > 0;

          return (
            <Card key={batch.id} className="border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <CardTitle className="text-base font-bold text-foreground">
                      Research Batch ({safeLeads.length} Verified Accounts)
                    </CardTitle>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs px-2.5 py-0.5 font-medium border border-amber-500/20">
                      Pending Review
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Discovered on {new Date(batch.createdAt).toLocaleString()} by AI Researcher Agents
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-3"
                    onClick={() => toggleSelectAll(batch.id, allLeadIds)}
                  >
                    {isAllSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {safeLeads.map((lead) => {
                  const isChecked = selected.has(lead.id);

                  return (
                    <div
                      key={lead.id}
                      onClick={() => toggleLeadSelection(batch.id, lead.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isChecked
                          ? "border-primary/50 bg-primary/5 shadow-xs"
                          : "border-border/60 bg-muted/10 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* Checkbox & Company Meta */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div
                          className={`mt-1 h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-background"
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5" />}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{lead.companyName}</span>
                            <Badge variant="outline" className="text-xs font-normal border-border bg-background">
                              {lead.subSegment || lead.industry || "Manufacturing"}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {lead.companyDomain && (
                              <a
                                href={`https://${lead.companyDomain}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                {lead.companyDomain}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 opacity-70" />
                              {lead.locationCity || "Bengaluru"}, India
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Executive Info */}
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-4 text-xs w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-border/50">
                        <div className="bg-background/80 p-2.5 rounded-lg border border-border/70 w-full sm:w-56 space-y-0.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-primary opacity-80" />
                            {lead.contactName || "Executive Decision Maker"}
                          </div>
                          <div className="text-muted-foreground text-xs">{lead.contactTitle || "Head of Operations"}</div>
                          <div className="text-primary flex items-center gap-1.5 pt-0.5 truncate font-mono text-xs">
                            <Mail className="h-3 w-3 opacity-70 shrink-0" />
                            {lead.contactEmail}
                          </div>
                          {lead.contactPhone && (
                            <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-(length:--text-nano)">
                              <Phone className="h-3 w-3 opacity-70 shrink-0" />
                              {lead.contactPhone}
                            </div>
                          )}
                        </div>

                        {/* Score */}
                        <div className="text-right shrink-0 flex flex-col items-end justify-center w-24">
                          <Badge
                            variant="secondary"
                            className={`text-xs font-semibold px-2.5 py-1 ${
                              (lead.leadScore ?? 0) >= 80
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            Score: {lead.leadScore ?? 0}/100
                          </Badge>
                          <span className="text-(length:--text-nano) text-muted-foreground mt-1">Verified Real Lead</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>

              <CardFooter className="p-4 bg-muted/20 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">{selected.size}</span> of {safeLeads.length} accounts selected for internal database storage
                </div>

                <Button
                  size="default"
                  className="text-xs px-5 h-9 w-full sm:w-auto font-semibold shadow-sm"
                  onClick={() => handleApproveBatch(batch.id)}
                  disabled={processingBatchId === batch.id || selected.size === 0}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  {processingBatchId === batch.id ? "Saving to Database..." : `✓ Approve & Save to Database (${selected.size})`}
                </Button>
              </CardFooter>
            </Card>
          );
        })
      )}
    </div>
  );
}
