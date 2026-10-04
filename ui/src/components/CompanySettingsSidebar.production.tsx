import {
  ChevronLeft,
  Download,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { useSidebar } from "@/context/SidebarContext";
import { SidebarNavItem } from "./SidebarNavItem.production";

export function CompanySettingsSidebar() {
  const { selectedCompany } = useCompany();
  const { isMobile, setSidebarOpen } = useSidebar();

  return (
    <aside className="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      <div className="flex flex-col gap-1 px-3 py-3 shrink-0">
        <Link
          to="/sales"
          onClick={() => {
            if (isMobile) setSidebarOpen(false);
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">← Back to Sales Hub</span>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem to="/company/settings" label="Sales & Sender Settings" icon={SlidersHorizontal} end />
          <SidebarNavItem to="/company/settings/members" label="Team Members" icon={Users} end />
          <SidebarNavItem to="/company/export" label="Export Data" icon={Download} />
        </div>
      </nav>
    </aside>
  );
}
