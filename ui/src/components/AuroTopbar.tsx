import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronsUpDown, Command, LogOut, Menu, Moon, Sun } from "lucide-react";
import { authApi } from "@/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import { useSidebar } from "@/context/SidebarContext";
import { useOptionalTheme } from "@/context/ThemeContext";
import { useInboxBadge } from "@/hooks/useInboxBadge";
import { useSignOut } from "@/hooks/useSignOut";
import { AuroLogo } from "./AuroLogo";

function openCommandPalette() {
  window.dispatchEvent(new Event("auro:open-command-palette"));
}

export function AuroTopbar({ mobile = false }: { mobile?: boolean }) {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { toggleSidebar, toggleCollapsed, collapsed } = useSidebar();
  const themeContext = useOptionalTheme();
  const theme = themeContext?.theme ?? "light";
  const toggleTheme = themeContext?.toggleTheme ?? (() => {});
  const badge = useInboxBadge(selectedCompanyId);
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const signOut = useSignOut();
  const displayName = session?.user.name?.trim() || "Board";
  const email = session?.user.email?.trim() || "Local workspace";
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const aboutPath = selectedCompany?.issuePrefix ? `/${selectedCompany.issuePrefix}/about` : "/companies";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const toggleNavigation = () => mobile ? toggleSidebar() : toggleCollapsed();

  return (
    <header className="auro-topbar sticky top-0 z-30 flex h-(--sz-60px) shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:px-5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleNavigation}
        aria-label={mobile ? "Open navigation" : collapsed ? "Expand navigation" : "Collapse navigation"}
        className="shrink-0"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Link to={selectedCompany ? `/${selectedCompany.issuePrefix}/sales` : "/companies"} className="shrink-0" aria-label="Project Auro home">
        <AuroLogo className="hidden sm:inline-flex" markClassName="size-7" />
        <img src="/auro-mark.svg" alt="Project Auro" className="size-8 sm:hidden" />
      </Link>
      <div className="hidden min-w-0 items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Current organization">
        <ChevronsUpDown className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate font-medium text-foreground">{selectedCompany?.name ?? "Organizations"}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={openCommandPalette}
        className="ml-auto h-9 min-w-0 flex-1 justify-start gap-2 border-input bg-card px-3 text-muted-foreground hover:bg-accent md:ml-6 md:max-w-md"
        aria-label="Search Project Auro (Control or Command K)"
      >
        <Command className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">Search leads, campaigns, agents…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-(length:--text-nano) text-muted-foreground sm:inline">Ctrl K</kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        asChild
        className="relative shrink-0"
        aria-label={`Notifications${badge.inbox ? `, ${badge.inbox} unread` : ""}`}
      >
        <Link to="/inbox">
          <Bell aria-hidden="true" />
          {badge.inbox > 0 ? <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive ring-2 ring-background" aria-hidden="true" /> : null}
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="hidden shrink-0 sm:inline-flex"
      >
        <ThemeIcon aria-hidden="true" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="size-9 shrink-0 rounded-full p-0" aria-label="Open profile menu">
            <Avatar size="sm">
              {session?.user.image ? <AvatarImage src={session.user.image} alt={displayName} /> : null}
              <AvatarFallback>{initials || "AU"}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link to="/company/settings">Organization settings</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to={aboutPath}>About Project Auro</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleTheme} className="sm:hidden">
            <ThemeIcon className="mr-2 size-4" aria-hidden="true" />
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </DropdownMenuItem>
          {session ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={signOut.isPending} onSelect={() => signOut.mutate()}>
                <LogOut className="mr-2 size-4" aria-hidden="true" />
                {signOut.isPending ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
