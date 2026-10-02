import { useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { ProjectKickoffWizard } from "@/components/ProjectKickoffWizard";
import { GovernanceOrgCard } from "@/components/GovernanceOrgCard";
import { GovernancePromptEditor } from "@/components/GovernancePromptEditor";
import { Sparkles, ShieldCheck, FileCode } from "lucide-react";

export function Governance() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<"kickoff" | "org" | "prompts">("kickoff");

  if (!selectedCompany) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Select or create a company to manage Project Governance.
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Project Governance & Kickoff
        </h1>
        <p className="text-sm text-muted-foreground">
          Autonomous governance organization, role prompts, and end-to-end document pack orchestration.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-4">
        <button
          type="button"
          onClick={() => setActiveTab("kickoff")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "kickoff"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Project Kickoff Wizard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("org")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "org"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Governance Org Structure
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prompts")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "prompts"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileCode className="h-4 w-4" />
          Governance Prompts
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-2 flex justify-center">
        {activeTab === "kickoff" && (
          <ProjectKickoffWizard companyId={selectedCompany.id} />
        )}

        {activeTab === "org" && (
          <GovernanceOrgCard companyId={selectedCompany.id} />
        )}

        {activeTab === "prompts" && (
          <GovernancePromptEditor />
        )}
      </div>
    </div>
  );
}
