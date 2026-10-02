import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { governanceApi, type GovernanceOrgStatus, type GovernanceAgentSummary } from "@/api/governance";
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle, ArrowDownRight, Sparkles, RefreshCw } from "lucide-react";

interface GovernanceOrgCardProps {
  companyId: string;
  onOrgProvisioned?: () => void;
}

const ROLES_INFO = [
  { role: "ceo", title: "CEO", name: "Chief Executive Officer", reportsTo: null, model: "opencode/deepseek-r1", budget: "$500" },
  { role: "cto", title: "CTO", name: "Chief Technology Officer", reportsTo: "CEO", model: "opencode/claude-sonnet-5", budget: "$300" },
  { role: "pm", title: "PM", name: "Product Manager", reportsTo: "CEO", model: "opencode/gpt-6-luna", budget: "$200" },
  { role: "qa", title: "QA", name: "Quality Assurance Lead", reportsTo: "CEO", model: "opencode/deepseek-r1", budget: "$150" },
  { role: "devops", title: "DevOps", name: "DevOps Engineer", reportsTo: "CEO", model: "opencode/claude-sonnet-5", budget: "$200" },
  { role: "security", title: "Security", name: "Security Officer", reportsTo: "CEO", model: "opencode/deepseek-r1", budget: "$250" },
];

export function GovernanceOrgCard({ companyId, onOrgProvisioned }: GovernanceOrgCardProps) {
  const [status, setStatus] = useState<GovernanceOrgStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await governanceApi.getStatus(companyId);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load governance org status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [companyId]);

  const handleProvision = async () => {
    setProvisioning(true);
    setError(null);
    setSuccess(false);

    try {
      await governanceApi.createOrg(companyId);
      setSuccess(true);
      await fetchStatus();
      if (onOrgProvisioned) {
        onOrgProvisioned();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to provision governance organization.");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <Card className="w-full max-w-5xl border-border bg-card shadow-lg">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">
                Project Governance Organization Template
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                One-click hierarchy: CEO leading CTO, PM, QA, DevOps, and Security agents
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status?.isComplete ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Org Active (6/6 Agents)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {status ? `${status.count}/6 Agents Provisioned` : "Not Configured"}
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStatus}
              disabled={loading || provisioning}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>All 6 executive and operational agents created with OpenCode model mappings and reporting lines.</span>
          </div>
        )}

        {/* Org Hierarchy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES_INFO.map((r) => {
            const existingAgent = status?.agents.find(
              (a) => a.role === r.role || a.name.toLowerCase() === r.role,
            );

            return (
              <div
                key={r.role}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 text-sm shadow-sm hover:border-border/80 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base text-foreground flex items-center gap-1.5">
                      {r.title}
                      {r.reportsTo && (
                        <span className="text-xs font-normal text-muted-foreground inline-flex items-center">
                          <ArrowDownRight className="h-3 w-3" /> reports to {r.reportsTo}
                        </span>
                      )}
                    </span>
                    {existingAgent ? (
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" title="Active" />
                    ) : (
                      <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/30" title="Pending" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{r.name}</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Model:</span>
                    <span className="font-mono font-medium text-foreground">{r.model}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Monthly Budget:</span>
                    <span className="font-medium text-foreground">{r.budget}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border bg-muted/10 py-4">
        <span className="text-xs text-muted-foreground">
          Models sourced from OpenCode catalog via <code className="font-mono">config/models.yaml</code>.
        </span>

        <Button
          onClick={handleProvision}
          disabled={loading || provisioning}
          className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 gap-2"
        >
          {provisioning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Provisioning Org...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {status?.isComplete ? "Sync Governance Org" : "One-Click Provision Governance Org"}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
