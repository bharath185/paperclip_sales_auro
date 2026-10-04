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
      setHotLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load hot leads", err);
      setHotLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotLeads();
  }, [companyId]);

  const safeHotLeads = Array.isArray(hotLeads) ? hotLeads : [];

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
      ) : safeHotLeads.length === 0 ? (
        <Card className="border-border bg-card p-8 text-center space-y-2">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-medium text-foreground">No Hot Inbound Replies Yet</p>
          <p className="text-xs text-muted-foreground">
            As prospects respond to active 3-touch sequences with positive interest or meeting availability, they will surface here instantly.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {safeHotLeads.map((hl) => (
            <Card key={hl.id} className="border-border bg-card">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-foreground">{hl.companyName}</CardTitle>
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                      {hl.sentiment === "meeting_requested" ? "📅 Meeting Requested" : "🔥 High Interest"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Contact: <span className="text-foreground font-medium">{hl.contactName}</span> ({hl.contactEmail})
                  </CardDescription>
                </div>

                <div className="text-right text-xs text-muted-foreground">
                  {new Date(hl.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs italic text-foreground/90">
                  "{hl.replySnippet}"
                </div>

                <div className="flex justify-between items-center pt-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Routed to human sales rep
                  </span>

                  <a
                    href={`mailto:${hl.contactEmail}?subject=Re:%20Introductory%20Discussion`}
                    className="inline-flex"
                  >
                    <Button size="sm" className="h-7 text-xs">
                      <Mail className="mr-1.5 h-3.5 w-3.5" /> Reply to Prospect
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
