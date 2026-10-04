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
import { SidebarNavItem } from "./SidebarNavItem";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { useStreamlinedUiEnabled } from "../hooks/useStreamlinedUiEnabled";
import { cn } from "../lib/utils";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";
import { primarySidebarStyles } from "./primary-sidebar-styles";

export function Sidebar({ children }: { children?: ReactNode }) {
  const [configurationOpen, setConfigurationOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const { collapsed, peeking } = useSidebar();
  const { enabled: streamlinedUiEnabled } = useStreamlinedUiEnabled();
  const inboxBadge = useInboxBadge(selectedCompanyId);

  return (
    <aside
      data-auro-sidebar
      className={cn(
        "auro-sidebar w-full h-full min-h-0 flex flex-col bg-sidebar text-sidebar-foreground",
        streamlinedUiEnabled
          ? primarySidebarStyles.surface
          : "border-r border-sidebar-border",
      )}
    >
      {/* Top bar: workspace / company name */}
      <div className="flex h-(--sz-60px) shrink-0 items-center gap-1 px-3">
        <SidebarCompanyMenu />
      </div>

      <nav className={primarySidebarStyles.nav}>
        {/* Core Sales Operations */}
        <div className={primarySidebarStyles.group}>
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
