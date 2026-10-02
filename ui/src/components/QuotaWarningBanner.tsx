import React from "react";
import { AlertTriangle } from "lucide-react";

export interface QuotaWarningBannerProps {
  percentUsed: number;
  threshold?: number;
  provider?: string;
  credentialLast4?: string | null;
  className?: string;
}

export function QuotaWarningBanner({
  percentUsed,
  threshold = 80,
  provider,
  credentialLast4,
  className = "",
}: QuotaWarningBannerProps) {
  if (percentUsed < threshold) {
    return null;
  }

  const isCritical = percentUsed >= 95;

  return (
    <div
      role="alert"
      data-testid="quota-warning-banner"
      className={`flex items-start gap-3 p-3 border ${
        isCritical
          ? "bg-(--status-task-blocked)/10 border-(--status-task-blocked)/40 text-foreground"
          : "bg-(--status-task-todo)/10 border-(--status-task-todo)/40 text-foreground"
      } ${className}`}
    >
      <AlertTriangle
        className={`h-4 w-4 mt-0.5 shrink-0 ${
          isCritical ? "text-(--status-task-blocked)" : "text-(--status-task-todo)"
        }`}
      />
      <div className="min-w-0 text-xs">
        <div className="font-semibold flex items-center gap-2">
          <span>{isCritical ? "Critical Quota Alert" : "Quota Warning"} ({Math.round(percentUsed)}% Used)</span>
          {credentialLast4 && (
            <span className="font-mono text-muted-foreground font-normal">
              Key: ••••{credentialLast4}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-muted-foreground">
          {provider ? `${provider} usage` : "Usage"} has reached {Math.round(percentUsed)}% of quota limit (warning threshold is {threshold}%). Automatic fallback will activate if rate limits (429/5xx) are encountered.
        </p>
      </div>
    </div>
  );
}
