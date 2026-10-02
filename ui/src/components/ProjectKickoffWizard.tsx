import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { governanceApi, type KickoffResponse, type ProjectKickoffBriefPayload } from "@/api/governance";
import { CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight, FileText, Users, ShieldCheck, Cpu } from "lucide-react";

interface ProjectKickoffWizardProps {
  companyId: string;
  onSuccess?: (result: KickoffResponse) => void;
  onCancel?: () => void;
}

export function ProjectKickoffWizard({
  companyId,
  onSuccess,
  onCancel,
}: ProjectKickoffWizardProps) {
  const [formData, setFormData] = useState<ProjectKickoffBriefPayload>({
    projectName: "",
    problem: "",
    targetUsers: "",
    goals: "",
    constraints: "",
    budget: "",
    deadline: "",
    preferredStack: "TypeScript, Node.js, React, Tailwind CSS, PostgreSQL",
    integrations: "",
    teamSizeAndSkills: "",
    attachments: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KickoffResponse | null>(null);

  const handleChange = (field: keyof ProjectKickoffBriefPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName.trim()) {
      setError("Project Name is required.");
      return;
    }
    if (!formData.problem.trim()) {
      setError("Problem Statement is required.");
      return;
    }
    if (!formData.targetUsers.trim()) {
      setError("Target Users specification is required.");
      return;
    }
    if (!formData.goals.trim()) {
      setError("Project Goals are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await governanceApi.submitKickoff(companyId, formData);
      setResult(response);
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate project kickoff orchestration.");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card className="w-full max-w-4xl border-border bg-card shadow-lg">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
            <CardTitle className="text-xl font-semibold text-foreground">
              Project Kickoff Orchestrated Successfully
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            The Goal for <strong>{result.projectName}</strong> has been created and assigned to the CEO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Company Goal ID
              </span>
              <p className="mt-1 font-mono text-sm text-foreground">{result.goalId}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                CEO Kickoff Task ID
              </span>
              <p className="mt-1 font-mono text-sm text-foreground">{result.kickoffIssueId}</p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Generated Project Document Pack & Workstreams ({result.workstreams.length})
            </h4>
            <div className="space-y-3">
              {result.workstreams.map((ws) => (
                <div
                  key={ws.issueId}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase font-mono text-xs">
                        {ws.role}
                      </Badge>
                      <span className="font-medium text-foreground">{ws.taskTitle}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {ws.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ws.documents.map((doc) => (
                      <span
                        key={doc.fileName || doc.kind}
                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
                      >
                        <FileText className="h-3 w-3 text-emerald-500" />
                        {doc.fileName || doc.title}
                      </span>
                    ))}
                  </div>
                  {ws.reviews.length > 0 && (
                    <div className="mt-1 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Cross-Review: </span>
                      {ws.reviews.join(" ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              Executive Summary Preview
            </h4>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-background p-3 font-mono text-xs text-muted-foreground border border-border">
              {result.projectPackSummary.content}
            </pre>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t border-border bg-muted/10">
          <Button
            type="button"
            onClick={() => {
              setResult(null);
              if (onCancel) onCancel();
            }}
          >
            Done
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl border-border bg-card shadow-lg">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">
                Project Kickoff Wizard
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Define requirements and launch autonomous Governance org document generation
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            Auro Governance
          </Badge>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Core Project Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              1. Project Fundamentals
            </h3>

            <div className="space-y-2">
              <Label htmlFor="projectName">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                placeholder="e.g. NextGen Microservices Platform"
                value={formData.projectName}
                onChange={(e) => handleChange("projectName", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="problem">
                  Problem Statement <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="problem"
                  rows={4}
                  placeholder="Describe the core business problem and why this project is needed..."
                  value={formData.problem}
                  onChange={(e) => handleChange("problem", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetUsers">
                  Target Users & Personas <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="targetUsers"
                  rows={4}
                  placeholder="Who are the end users, administrators, and stakeholder personas?"
                  value={formData.targetUsers}
                  onChange={(e) => handleChange("targetUsers", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goals">
                Goals & Key Deliverables <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="goals"
                rows={3}
                placeholder="List measurable outcomes, target metrics, and primary features..."
                value={formData.goals}
                onChange={(e) => handleChange("goals", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 2: Boundaries, Budget & Timeline */}
          <div className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              2. Scope, Constraints & Budget
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (USD / Resources)</Label>
                <Input
                  id="budget"
                  placeholder="e.g. 50000"
                  value={formData.budget}
                  onChange={(e) => handleChange("budget", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Target Deadline</Label>
                <Input
                  id="deadline"
                  placeholder="e.g. Q4 2026 / 3 Months"
                  value={formData.deadline}
                  onChange={(e) => handleChange("deadline", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="constraints">Constraints & Boundaries</Label>
                <Input
                  id="constraints"
                  placeholder="e.g. SOC2, GDPR, Strict Latency < 100ms"
                  value={formData.constraints}
                  onChange={(e) => handleChange("constraints", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Technical & Team Stack */}
          <div className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-500" />
              3. Technology Stack & Team Capabilities
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredStack">Preferred Tech Stack</Label>
                <Input
                  id="preferredStack"
                  placeholder="e.g. TypeScript, React, Go, PostgreSQL, AWS"
                  value={formData.preferredStack}
                  onChange={(e) => handleChange("preferredStack", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="integrations">Required Integrations & APIs</Label>
                <Input
                  id="integrations"
                  placeholder="e.g. Stripe, SendGrid, GitHub Actions, Slack"
                  value={formData.integrations}
                  onChange={(e) => handleChange("integrations", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teamSizeAndSkills">Manual Team Size & Skills</Label>
                <Input
                  id="teamSizeAndSkills"
                  placeholder="e.g. 2 Senior Full-Stack Devs, 1 QA Engineer"
                  value={formData.teamSizeAndSkills}
                  onChange={(e) => handleChange("teamSizeAndSkills", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">Attachments / Link References</Label>
                <Input
                  id="attachments"
                  placeholder="e.g. https://docs.example.com/spec or file URI"
                  value={formData.attachments}
                  onChange={(e) => handleChange("attachments", e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border bg-muted/10 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Orchestrating Governance Pack...
              </>
            ) : (
              <>
                Submit & Launch Kickoff
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
