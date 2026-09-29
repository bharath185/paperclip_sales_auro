import { cn } from "@/lib/utils";

export function AuroLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <img className={cn("size-8 shrink-0", markClassName)} src="/auro-mark.svg" alt="" />
      <span className="truncate text-sm font-semibold tracking-tight text-foreground">Project Auro</span>
    </span>
  );
}
