import {
  Inbox,
  Search,
  Settings,
  Users,
  TrendingUp,
  History,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem.production";
import { useCompany } from "../context/CompanyContext";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu.production";

export function Sidebar({ children }: { children?: ReactNode }) {
  const [configurationOpen, setConfigurationOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);

  return (
    <aside
      data-auro-sidebar
      className="auro-sidebar w-full h-full min-h-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
    >
      {/* Top bar: workspace / company name */}
      <div className="flex h-12 shrink-0 items-center gap-1 px-3">
        <SidebarCompanyMenu />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 pointer-coarse:gap-3 px-3 py-2">
        {/* Core Sales Operations */}
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem to="/sales" label="Sales Hub" icon={TrendingUp} />
          <SidebarNavItem
            to="/inbox"
            label="Approvals & Inbox"
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeLabel="pending"
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <SidebarNavItem to="/agents" label="Sales Team" icon={Users} />
          <SidebarNavItem to="/search" label="Search" icon={Search} />
        </div>

        {/* Configuration & Administration */}
        <SidebarSection label="Configuration" collapsible={{ open: configurationOpen, onOpenChange: setConfigurationOpen }}>
          <SidebarNavItem to="/company/settings" label="Settings & Keys" icon={Settings} />
          <SidebarNavItem to="/activity" label="Audit Log" icon={History} />
        </SidebarSection>

        {children}
      </nav>
    </aside>
  );
}
