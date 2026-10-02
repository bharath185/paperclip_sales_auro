import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi } from "@/api/sales";
import { ShieldCheck, UserX, Plus, Lock, CheckCircle2 } from "lucide-react";

interface SuppressionManagerProps {
  companyId: string;
}

export function SuppressionManager({ companyId }: SuppressionManagerProps) {
  const [suppressions, setSuppressions] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSuppressions = async () => {
    setLoading(true);
    try {
      const data = await salesApi.listSuppressions(companyId);
      setSuppressions(data.suppressions || []);
    } catch (err) {
      console.error("Failed to load suppressions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppressions();
  }, [companyId]);

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) return;

    setSubmitting(true);
    setSuccessMsg(null);
    try {
      const res = await salesApi.addSuppression(companyId, newEmail.trim());
      setNewEmail("");
      setSuccessMsg(`Address suppressed permanently with SHA-256 hash ${res.emailHash.substring(0, 16)}...`);
      await fetchSuppressions();
    } catch (err) {
      console.error("Failed to add suppression", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Global Email Suppression &amp; Privacy Safeguards</h3>
        <p className="text-xs text-muted-foreground">
          Permanent opt-out and bounce suppression list compliant with India DPDP Act, CAN-SPAM, and GDPR.
        </p>
      </div>

      {/* Add suppression form */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" /> Suppress Email Address
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Any email added here is immediately hashed via SHA-256 and permanently blocked from receiving sequence touches across all campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddSuppression} className="flex gap-2">
            <Input
              placeholder="e.g. prospect.optout@example.com"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="text-xs"
              required
            />
            <Button type="submit" size="sm" disabled={submitting}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Suppress
            </Button>
          </form>

          {successMsg && (
            <div className="mt-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suppression list */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-semibold">
              Hashed Suppression Registry ({suppressions.length} Records)
            </CardTitle>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Lock className="h-3 w-3 text-primary" /> SHA-256 Anonymized
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading suppression registry...</div>
          ) : suppressions.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No email addresses currently suppressed.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {suppressions.map((hash) => (
                <div key={hash} className="p-3 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{hash}</span>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                    Permanently Suppressed
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
