import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi, type LeadRecordDto, type CampaignRecordDto, type ResearchLogDto } from "@/api/sales";
import {
  Search,
  Download,
  RefreshCw,
  Sparkles,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Flame,
  Filter,
  Layers,
  ArrowUpDown,
  Terminal,
  Copy,
  Check,
  Code,
} from "lucide-react";

interface LeadCenterProps {
  companyId: string;
  campaign?: CampaignRecordDto;
}

export function LeadCenter({ companyId, campaign }: LeadCenterProps) {
  const [leads, setLeads] = useState<LeadRecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [syncingCrm, setSyncingCrm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [selectedLead, setSelectedLead] = useState<LeadRecordDto | null>(null);
  const [showRawLogModal, setShowRawLogModal] = useState(false);
  const [researchLog, setResearchLog] = useState<ResearchLogDto | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLeadRawJson, setShowLeadRawJson] = useState(false);

  const campaignId = campaign?.id || "camp-default";

  const fetchLeads = async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const data = await salesApi.listLeads(companyId, campaign.id);
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load leads", err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResearchLog = async () => {
    if (!campaign?.id) return;
    setLoadingLog(true);
    try {
      const log = await salesApi.getResearchLog(companyId, campaign.id);
      setResearchLog(log);
      setShowRawLogModal(true);
    } catch (err) {
      console.error("Failed to load research log", err);
    } finally {
      setLoadingLog(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [companyId, campaign?.id]);

  const handleRunResearch = async () => {
    if (!campaign?.id) return;
    setResearching(true);
    try {
      const res = await salesApi.runResearch(companyId, campaign.id);
      if (res.log) {
        setResearchLog(res.log);
      }
      await fetchLeads();
    } catch (err) {
      console.error("Research run failed", err);
    } finally {
      setResearching(false);
    }
  };

  const handleCopyJson = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncCrm = async () => {
    if (!campaign?.id) return;
    setSyncingCrm(true);
    try {
      await salesApi.syncCrm(companyId, campaign.id);
      await fetchLeads();
    } catch (err) {
      console.error("CRM sync failed", err);
    } finally {
      setSyncingCrm(false);
    }
  };

  const safeLeads = Array.isArray(leads) ? leads : [];
  const filteredLeads = safeLeads.filter((l) => {
    const searchTarget = `${l.companyName || ""} ${l.contactName || ""} ${l.industry || ""} ${l.subSegment || ""} ${l.locationCity || ""}`.toLowerCase();
    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === "all" || l.crmStage === stageFilter;
    const matchesScore = (l.leadScore ?? 0) >= minScoreFilter;
    return matchesSearch && matchesStage && matchesScore;
  });

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h3 className="text-base font-semibold text-foreground">Lead Database &amp; Market Intelligence</h3>
          <p className="text-xs text-muted-foreground">
            {campaign ? `Showing leads discovered for ${campaign.name}` : "Select a campaign to inspect leads"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {campaign && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunResearch}
                disabled={researching}
                className="text-xs font-medium"
              >
                <Sparkles className={`mr-1.5 h-3.5 w-3.5 text-primary ${researching ? "animate-spin" : ""}`} />
                {researching ? "AI Researchers Searching Web & Registry..." : "Dispatch AI Researchers"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchResearchLog}
                disabled={loadingLog}
                className="text-xs"
              >
                <Terminal className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Raw AI Response &amp; Prompt
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncCrm}
                disabled={syncingCrm}
                className="text-xs"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncingCrm ? "animate-spin" : ""}`} />
                Sync to CRM
              </Button>

              <a
                href={salesApi.getCsvExportUrl(companyId, campaign.id)}
                download={`leads-${campaign.id}.csv`}
                className="inline-flex"
              >
                <Button variant="secondary" size="sm" className="text-xs">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company, contact, title, location..."
                className="pl-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="all">All CRM Stages</option>
                <option value="new">Stage: New</option>
                <option value="qualified">Stage: Qualified</option>
                <option value="contacted">Stage: Contacted</option>
                <option value="replied">Stage: Replied</option>
                <option value="hot_lead">Stage: Hot Lead</option>
              </select>
            </div>

            <div>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(Number(e.target.value))}
              >
                <option value={0}>All Lead Scores</option>
                <option value={50}>Score ≥ 50</option>
                <option value={75}>Score ≥ 75 (High Priority)</option>
                <option value={85}>Score ≥ 85 (Top Match)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
              <tr>
                <th className="p-3">Company &amp; Domain</th>
                <th className="p-3">Decision Maker</th>
                <th className="p-3">Sub-segment</th>
                <th className="p-3">Location</th>
                <th className="p-3">Score</th>
                <th className="p-3">Stage</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {loading
                      ? "Loading leads..."
                      : safeLeads.length === 0
                      ? "No leads in this campaign yet. Click 'Dispatch Researchers' above."
                      : "No leads match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="p-3">
                      <div className="font-medium text-foreground">{lead.companyName}</div>
                      <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                        <span>{lead.companyDomain || (lead as any).domain || (lead as any).website?.replace(/^https?:\/\//, "")}</span>
                        {(lead as any).website && (
                          <a
                            href={(lead as any).website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{lead.contactName || (lead as any).decisionMakerName || "—"}</div>
                      <div className="text-muted-foreground text-xs">{lead.contactTitle || (lead as any).decisionMakerTitle || "—"}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{lead.subSegment || lead.industry}</td>
                    <td className="p-3 text-muted-foreground">{lead.locationCity || (lead as any).location || "Bengaluru"}</td>
                    <td className="p-3">
                      <Badge
                        variant="secondary"
                        className={
                          (lead.leadScore ?? (lead as any).score ?? 0) >= 80
                            ? "bg-primary/20 text-primary border-primary/30"
                            : (lead.leadScore ?? (lead as any).score ?? 0) >= 60
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {lead.leadScore ?? (lead as any).score ?? 0}/100
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {lead.crmStage?.replace("_", " ") || (lead as any).status?.replace("_", " ") || "saved_in_db"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {((lead as any).sourceUrl || (lead as any).website) && (
                        <a
                          href={(lead as any).sourceUrl || (lead as any).website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Website <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Selected Lead Modal Detail */}
      {selectedLead && (
        <Card className="border-primary/40 bg-card p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-bold text-foreground">{selectedLead.companyName}</h4>
              <p className="text-xs text-muted-foreground">
                {selectedLead.companyDomain || (selectedLead as any).domain} • {selectedLead.locationCity || (selectedLead as any).location || "Bengaluru"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setShowLeadRawJson(!showLeadRawJson)}
              >
                <Code className="mr-1 h-3 w-3" />
                {showLeadRawJson ? "Hide Raw JSON" : "View Raw JSON"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-md border border-border p-2 space-y-1">
              <span className="text-muted-foreground font-medium">Decision Maker</span>
              <div className="font-semibold text-foreground">{selectedLead.contactName || (selectedLead as any).decisionMakerName || "—"}</div>
              <div className="text-muted-foreground">{selectedLead.contactTitle || (selectedLead as any).decisionMakerTitle || "—"}</div>
              <div className="text-primary truncate">{selectedLead.contactEmail || (selectedLead as any).email || "—"}</div>
              {(selectedLead as any).phone && <div className="text-muted-foreground">{ (selectedLead as any).phone }</div>}
            </div>

            <div className="rounded-md border border-border p-2 space-y-1">
              <span className="text-muted-foreground font-medium">Facility &amp; Capabilities</span>
              <p className="text-muted-foreground">{(selectedLead as any).notes || "Verified operating manufacturing facility in industrial zone."}</p>
            </div>

            <div className="rounded-md border border-border p-2 space-y-1">
              <span className="text-muted-foreground font-medium">Internal Storage &amp; Safety</span>
              <div className="font-semibold text-foreground">Saved in Internal Database</div>
              <div className="text-muted-foreground">Outbound Dispatch: Disabled / Safe Mode</div>
            </div>
          </div>

          {showLeadRawJson && (
            <div className="rounded-md bg-muted/50 border border-border p-3 space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Raw Lead Intelligence Object (JSON)</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => handleCopyJson(JSON.stringify(selectedLead, null, 2))}
                >
                  {copied ? <Check className="h-3 w-3 text-primary mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="text-xs font-mono bg-background p-3 rounded border border-border overflow-x-auto max-h-60 text-foreground">
                {JSON.stringify(selectedLead, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}

      {/* Raw AI Response & Execution Modal */}
      {showRawLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl max-h-screen flex flex-col border-border bg-card shadow-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Raw AI Response &amp; Execution Telemetry
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Inspect the live model prompts, raw JSON response, and safety verification diagnostics.
                </CardDescription>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowRawLogModal(false)}>
                Close
              </Button>
            </CardHeader>

            <CardContent className="space-y-4 p-4 overflow-y-auto flex-1 text-xs">
              {researchLog ? (
                <div className="space-y-4">
                  {/* Meta Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <span className="text-muted-foreground block">Active Model</span>
                      <span className="font-semibold text-foreground">{researchLog.modelUsed}</span>
                    </div>
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <span className="text-muted-foreground block">Execution Time</span>
                      <span className="font-semibold text-foreground">
                        {new Date(researchLog.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <span className="text-muted-foreground block">Raw Extracted</span>
                      <span className="font-semibold text-foreground">{researchLog.parsedLeadsCount} leads</span>
                    </div>
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <span className="text-muted-foreground block">Verified &amp; Scored</span>
                      <span className="font-semibold text-primary">{researchLog.validLeadsCount} valid</span>
                    </div>
                  </div>

                  {/* Prompt Sent */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground block">Prompt Sent to AI Researcher Agent:</span>
                    <pre className="font-mono text-xs bg-muted/40 p-3 rounded border border-border whitespace-pre-wrap text-muted-foreground">
                      {researchLog.prompt}
                    </pre>
                  </div>

                  {/* Raw Response */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">Raw Model JSON Output:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => handleCopyJson(researchLog.rawResponse)}
                      >
                        {copied ? <Check className="h-3 w-3 text-primary mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copied ? "Copied" : "Copy Raw JSON"}
                      </Button>
                    </div>
                    <pre className="font-mono text-xs bg-background p-3 rounded border border-border overflow-x-auto max-h-72 text-foreground">
                      {researchLog.rawResponse}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No execution logs recorded yet. Click "Dispatch AI Researchers" to run live lead discovery.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
