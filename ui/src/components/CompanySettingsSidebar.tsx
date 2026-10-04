import {
  ArrowLeft,
  Download,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { ContextualSidebarFrame } from "./ContextualSidebarFrame";
import { primarySidebarStyles } from "./primary-sidebar-styles";

export function CompanySettingsSidebar() {
  return (
    <ContextualSidebarFrame
      surface="settings"
      title="Settings"
      showHeader={false}
      className={primarySidebarStyles.surface}
    >
      <div
        data-slot="settings-sidebar-header"
        className="flex h-(--sz-60px) shrink-0 items-center px-3"
      >
        <div data-slot="settings-back-group" className={`${primarySidebarStyles.group} w-full`}>
          <SidebarNavItem to="/sales" label="Back to Sales Hub" icon={ArrowLeft} />
        </div>
      </div>
      <nav
        aria-label="Settings"
        data-slot="settings-sidebar-nav"
        className={primarySidebarStyles.nav}
      >
        <div data-slot="settings-links-group" className={primarySidebarStyles.group}>
          <SidebarNavItem to="/company/settings" label="Sales & Sender Settings" icon={SlidersHorizontal} end />
          <SidebarNavItem to="/company/settings/members" label="Team Members" icon={Users} end />
          <SidebarNavItem to="/company/export" label="Export Data" icon={Download} />
        </div>
      </nav>
    </ContextualSidebarFrame>
  );
}
