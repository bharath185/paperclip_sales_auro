import type { SVGProps } from "react";
import { cn } from "../lib/utils";

export function AnimatedPaperclipIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("auro-mark-motion", className)}
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="2" width="60" height="60" rx="16" fill="var(--auro-forest)" />
      <path d="M14 46 29 15l15 31-15-8-15 8Z" fill="var(--auro-primary)" />
      <path d="m29 15 15 31-15-8" fill="var(--auro-lime)" />
      <circle cx="47" cy="17" r="5" fill="var(--auro-gold)" />
    </svg>
  );
}

/** Full-page loading state using the Auro mark. */
export function PaperclipLoading({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex min-h-dvh w-full items-center justify-center", className)}
    >
      <AnimatedPaperclipIcon className="h-24 w-24 text-muted-foreground" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
