import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesApi, type HotLeadEventDto } from "@/api/sales";
import { Flame, Mail, Calendar, CheckCircle2, UserCheck, MessageSquare, ArrowRight } from "lucide-react";

interface HotLeadsViewProps {
  companyId: string;
}

export function HotLeadsView({ companyId }: HotLeadsViewProps) {
  const [hotLeads, setHotLeads] = useState<HotLeadEventDto[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHotLeads = async () => {
    setLoading(true);
    try {
      const data = await salesApi.listHotLeads(companyId);
      setHotLeads(data);
    } catch (err) {
      console.error("Failed to load hot leads", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotLeads();
  }, [companyId]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Hot Leads &amp; Positive Inbound Replies</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Autonomous positive reply detection by the Follow-up Agent. High-intent prospects ready for human sales calls.
        </p>
      </div>

      {loading ? (
        <Card className="border-border bg-card p-8 text-center text-xs text-muted-foreground">
          Loading hot leads stream...
        </Card>
      ) : hotLeads.length === 0 ? (
        <Card className="border-border bg-card p-8 text-center space-y-2">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-medium text-foreground">No Hot Inbound Replies Yet</p>
          <p className="text-xs text-muted-foreground">
            As prospects respond to active 3-touch sequences with positive interest or meeting availability, they will surface here instantly.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {hotLeads.map((hl) => (
            <Card key={hl.id} className="border-border bg-card">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{hl.companyName}</CardTitle>
                    <Badge
                      variant="secondary"
                      className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold"
                    >
                      {hl.sentiment === "meeting_requested" ? "📅 Meeting Requested" : "🔥 Positive Interest"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    {hl.contactName} &lt;{hl.contactEmail}&gt; • Received {new Date(hl.detectedAt).toLocaleString()}
                  </CardDescription>
                </div>

                <Button size="sm" className="text-xs h-8">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" /> Book Call / Handoff
                </Button>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs italic text-foreground leading-relaxed">
                  "{hl.replySnippet}"
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Human notification dispatched
                  </span>
                  <span>Lead ID: {hl.leadId}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
