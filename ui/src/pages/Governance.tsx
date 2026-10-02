import { useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { ProjectKickoffWizard } from "@/components/ProjectKickoffWizard";
import { GovernanceOrgCard } from "@/components/GovernanceOrgCard";
import { GovernancePromptEditor } from "@/components/GovernancePromptEditor";
import { DocumentCenter } from "@/components/DocumentCenter";
import { TeamAssignmentView } from "@/components/TeamAssignmentView";
import { Sparkles, ShieldCheck, FileCode, BookOpen, Users } from "lucide-react";

export function Governance() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<"kickoff" | "docs" | "team" | "org" | "prompts">("docs");

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
          Autonomous governance organization, 12-document pack, team assignment, version diffs, and multi-format exports.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("docs")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors shrink-0 ${
            activeTab === "docs"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Document Center
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors shrink-0 ${
            activeTab === "team"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Team Allocation
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kickoff")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors shrink-0 ${
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
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors shrink-0 ${
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
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors shrink-0 ${
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
        {activeTab === "docs" && (
          <DocumentCenter companyId={selectedCompany.id} />
        )}

        {activeTab === "team" && (
          <TeamAssignmentView companyId={selectedCompany.id} />
        )}

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
