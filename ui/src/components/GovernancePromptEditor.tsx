import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { governanceApi, type GovernancePrompt } from "@/api/governance";
import { Loader2, Save, CheckCircle2, AlertCircle, RefreshCw, FileCode, Users } from "lucide-react";

const ROLES = [
  { id: "ceo", label: "CEO (Chief Executive Officer)", model: "opencode/deepseek-r1" },
  { id: "cto", label: "CTO (Chief Technology Officer)", model: "opencode/claude-sonnet-5" },
  { id: "pm", label: "PM (Product Manager)", model: "opencode/gpt-6-luna" },
  { id: "qa", label: "QA (Quality Assurance Lead)", model: "opencode/deepseek-r1" },
  { id: "devops", label: "DevOps (DevOps Engineer)", model: "opencode/claude-sonnet-5" },
  { id: "security", label: "Security (Security Officer)", model: "opencode/deepseek-r1" },
];

export function GovernancePromptEditor() {
  const [selectedRole, setSelectedRole] = useState("ceo");
  const [prompts, setPrompts] = useState<Record<string, GovernancePrompt>>({});
  const [currentContent, setCurrentContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrompts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await governanceApi.getPrompts();
      setPrompts(data);
      if (data[selectedRole]) {
        setCurrentContent(data[selectedRole].content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load governance prompts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    setSavedSuccess(false);
    setError(null);
    if (prompts[roleId]) {
      setCurrentContent(prompts[roleId].content);
    } else {
      setCurrentContent("");
    }
  };

  const handleSave = async () => {
    if (!currentContent.trim()) {
      setError("Prompt content cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      await governanceApi.updatePrompt(selectedRole, currentContent);
      setPrompts((prev) => ({
        ...prev,
        [selectedRole]: {
          ...prev[selectedRole],
          content: currentContent,
        },
      }));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prompt.");
    } finally {
      setSaving(false);
    }
  };

  const selectedRoleMeta = ROLES.find((r) => r.id === selectedRole);

  return (
    <Card className="w-full max-w-5xl border-border bg-card shadow-lg">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-xl font-semibold text-foreground">
                Governance System Prompts Editor
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground mt-1">
              Versioned system prompts stored in <code className="text-xs font-mono">prompts/governance/*.md</code>
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadPrompts}
            disabled={loading || saving}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-4">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => handleRoleChange(role.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${
                selectedRole === role.id
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{role.id.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Prompt for <strong>{selectedRoleMeta?.label}</strong> has been updated.</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {selectedRoleMeta?.label}
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              Model: {selectedRoleMeta?.model}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            prompts/governance/{selectedRole}.md
          </span>
        </div>

        <Textarea
          rows={16}
          value={currentContent}
          onChange={(e) => setCurrentContent(e.target.value)}
          disabled={loading || saving}
          placeholder="System prompt markdown content..."
          className="font-mono text-xs leading-relaxed bg-background"
        />
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border bg-muted/10 py-4">
        <span className="text-xs text-muted-foreground">
          Editable in UI and backed by versioned markdown files.
        </span>

        <Button
          onClick={handleSave}
          disabled={loading || saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Prompt
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
