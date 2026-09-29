import { ExternalLink, HeartHandshake, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuroLogo } from "@/components/AuroLogo";

export function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-3">
        <AuroLogo markClassName="size-12" />
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Project Auro is an operating system for AI organizations. Build teams of agents, govern their work, and bring approved plans and deliverables to your human team.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><HeartHandshake className="size-4 text-primary" aria-hidden="true" /> Built on Paperclip</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Project Auro is derived from Paperclip, the open-source control plane for AI-agent organizations.</p>
            <a className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4" href="https://github.com/paperclipai/paperclip" target="_blank" rel="noreferrer">
              Paperclip source repository <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Scale className="size-4 text-primary" aria-hidden="true" /> Open-source license</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>The Paperclip-derived source remains available under the MIT License. Copyright and license notices are retained in this distribution.</p>
            <a className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4" href="https://github.com/paperclipai/paperclip/blob/master/LICENSE" target="_blank" rel="noreferrer">
              Read the Paperclip MIT License <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
