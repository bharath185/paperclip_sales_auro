import { useState, useEffect } from "react";
import {
  governanceApi,
  type GovernanceDocSummary,
  type GovernanceDocDetail,
} from "@/api/governance";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  Download,
  ShieldCheck,
  Send,
  GitCompare,
  Save,
  FileCode,
  Layers,
  Sparkles,
} from "lucide-react";

interface DocumentCenterProps {
  companyId: string;
}

export function DocumentCenter({ companyId }: DocumentCenterProps) {
  const [docList, setDocList] = useState<GovernanceDocSummary[]>([]);
  const [packStatus, setPackStatus] = useState<"draft" | "in_review" | "approved">("in_review");
  const [projectName, setProjectName] = useState("Project Auro");
  const [selectedKind, setSelectedKind] = useState<string>("charter");
  const [currentDoc, setCurrentDoc] = useState<GovernanceDocDetail | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [activeTab, setActiveTab] = useState<"view" | "edit" | "diff" | "reviews">("view");
  const [diffVersion, setDiffVersion] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New review form
  const [reviewerRole, setReviewerRole] = useState("qa");
  const [reviewStatus, setReviewStatus] = useState<"approved" | "changes_requested">("approved");
  const [reviewComments, setReviewComments] = useState("");

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await governanceApi.listDocuments(companyId);
      setDocList(res.documents);
      setPackStatus(res.packStatus);
      setProjectName(res.projectName);
      if (res.documents.length > 0 && !selectedKind) {
        setSelectedKind(res.documents[0].kind);
      }
    } catch {
      setErrorMessage("Failed to load governance documents");
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentDoc = async (kind: string) => {
    try {
      const doc = await governanceApi.getDocument(companyId, kind);
      setCurrentDoc(doc);
      setEditedContent(doc.content);
      if (doc.versions.length > 1) {
        setDiffVersion(doc.versions.length - 1);
      } else {
        setDiffVersion(1);
      }
    } catch {
      setErrorMessage(`Failed to load document: ${kind}`);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [companyId]);

  useEffect(() => {
    if (selectedKind) {
      loadCurrentDoc(selectedKind);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [selectedKind, companyId]);

  const handleSaveDocument = async () => {
    if (!selectedKind || !editedContent.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await governanceApi.updateDocument(
        companyId,
        selectedKind,
        editedContent,
        changeSummary,
      );
      setSuccessMessage(`Document updated to v${res.version}`);
      setChangeSummary("");
      loadDocuments();
      loadCurrentDoc(selectedKind);
      setActiveTab("view");
    } catch {
      setErrorMessage("Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKind || !reviewComments.trim()) return;
    try {
      await governanceApi.reviewDocument(companyId, selectedKind, {
        reviewerRole,
        status: reviewStatus,
        comments: reviewComments,
      });
      setReviewComments("");
      setSuccessMessage("Review comment recorded successfully");
      loadCurrentDoc(selectedKind);
    } catch {
      setErrorMessage("Failed to post review comment");
    }
  };

  const handleCeoApprovePack = async () => {
    setApproving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await governanceApi.approvePack(companyId);
      setPackStatus("approved");
      setSuccessMessage(res.message);
      loadDocuments();
    } catch {
      setErrorMessage("Cannot approve pack: ensure all 12 documents are complete and valid.");
    } finally {
      setApproving(false);
    }
  };

  const getExportUrl = (format: string) => governanceApi.getExportUrl(companyId, format);

  const comparedVersion =
    currentDoc?.versions.find((v) => v.version === diffVersion) || currentDoc?.versions[0];

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Pack Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Document Center: {projectName}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                packStatus === "approved"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              {packStatus === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {packStatus === "approved" ? "Pack Approved by CEO" : "In Review"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Canonical 12-document governance pack, automated section validation, version diffs, and multi-format exports.
          </p>
        </div>

        {/* CEO Approval & Export Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {packStatus !== "approved" ? (
            <button
              type="button"
              onClick={handleCeoApprovePack}
              disabled={approving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {approving ? "Approving..." : "CEO Pack Sign-off"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4" /> Formally Approved
            </span>
          )}

          {/* Export Buttons */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border text-xs">
            <a
              href={getExportUrl("zip")}
              download
              className="px-2.5 py-1.5 rounded hover:bg-background transition-colors font-medium flex items-center gap-1"
              title="Download full pack as ZIP archive"
            >
              <Download className="h-3.5 w-3.5" /> ZIP
            </a>
            <a
              href={getExportUrl("pdf")}
              download
              className="px-2.5 py-1.5 rounded hover:bg-background transition-colors font-medium flex items-center gap-1"
              title="Export as PDF"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <a
              href={getExportUrl("docx")}
              download
              className="px-2.5 py-1.5 rounded hover:bg-background transition-colors font-medium flex items-center gap-1"
              title="Export as Microsoft Word DOCX"
            >
              <Download className="h-3.5 w-3.5" /> DOCX
            </a>
            <a
              href={getExportUrl("jira-csv")}
              download
              className="px-2.5 py-1.5 rounded hover:bg-background transition-colors font-medium flex items-center gap-1"
              title="Export Jira-importable CSV backlog"
            >
              <Download className="h-3.5 w-3.5" /> Jira CSV
            </a>
            <a
              href={getExportUrl("sprint-xlsx")}
              download
              className="px-2.5 py-1.5 rounded hover:bg-background transition-colors font-medium flex items-center gap-1"
              title="Export Sprint Backlog XLSX Spreadsheet"
            >
              <Download className="h-3.5 w-3.5" /> XLSX
            </a>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Document List (Left) + Document Viewer / Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Sidebar (4 columns) */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
            12 Governance Deliverables ({docList.length})
          </h3>
          <div className="space-y-1 rounded-xl border border-border bg-card p-2">
            {docList.map((d) => (
              <button
                key={d.kind}
                type="button"
                onClick={() => setSelectedKind(d.kind)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                  selectedKind === d.kind
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "text-foreground hover:bg-muted/70"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{d.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">v{d.currentVersion}</span>
                  {d.isValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Document Workspace (8 columns) */}
        <div className="lg:col-span-8 space-y-4">
          {currentDoc ? (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              {/* Workspace Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    {currentDoc.title}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({currentDoc.fileName})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Author: <strong className="uppercase">{currentDoc.authorRole}</strong></span>
                    <span>•</span>
                    <span>Version: <strong>v{currentDoc.currentVersion}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {currentDoc.isValid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Valid Section Structure
                        </span>
                      ) : (
                        <span className="text-destructive font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Missing: {currentDoc.missingSections.join(", ")}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("view")}
                    className={`px-3 py-1.5 rounded transition-colors font-medium ${
                      activeTab === "view" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("edit")}
                    className={`px-3 py-1.5 rounded transition-colors font-medium ${
                      activeTab === "edit" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("diff")}
                    className={`px-3 py-1.5 rounded transition-colors font-medium ${
                      activeTab === "diff" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    Diff ({currentDoc.versions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("reviews")}
                    className={`px-3 py-1.5 rounded transition-colors font-medium flex items-center gap-1 ${
                      activeTab === "reviews" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3" /> Reviews ({currentDoc.reviews.length})
                  </button>
                </div>
              </div>

              {/* TAB 1: Markdown Preview */}
              {activeTab === "view" && (
                <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/20 p-4 rounded-lg border border-border overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {currentDoc.content}
                </div>
              )}

              {/* TAB 2: Markdown Editor */}
              {activeTab === "edit" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Markdown Content
                    </label>
                    <textarea
                      rows={16}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background p-3 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Change Summary (Revision notes)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Added section on load balancing and cache invalidation"
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedContent(currentDoc.content);
                        setActiveTab("view");
                      }}
                      className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDocument}
                      disabled={saving || !editedContent.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? "Saving..." : "Save New Version"}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Version Diff */}
              {activeTab === "diff" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Compare v{currentDoc.currentVersion} (Current) with:
                    </span>
                    <select
                      value={diffVersion}
                      onChange={(e) => setDiffVersion(Number(e.target.value))}
                      className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground"
                    >
                      {currentDoc.versions.map((v) => (
                        <option key={v.version} value={v.version}>
                          v{v.version} - {v.changeSummary.slice(0, 40)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                        Comparing Version v{comparedVersion?.version}
                      </div>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                        {comparedVersion?.content}
                      </pre>
                    </div>

                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2">
                        Latest Version v{currentDoc.currentVersion}
                      </div>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                        {currentDoc.content}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Reviews & Comments */}
              {activeTab === "reviews" && (
                <div className="space-y-4">
                  {/* Reviews List */}
                  <div className="space-y-2">
                    {currentDoc.reviews.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-3 text-center border border-dashed border-border rounded-lg">
                        No agent reviews recorded for this document yet.
                      </p>
                    ) : (
                      currentDoc.reviews.map((r, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground uppercase tracking-wide">
                              {r.reviewerRole} Reviewer
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                                r.status === "approved"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-destructive/15 text-destructive"
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                          <p className="text-foreground leading-relaxed">{r.comments}</p>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Review Form */}
                  <form onSubmit={handlePostReview} className="p-3 rounded-lg border border-border bg-card space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">Post Review Comment</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Reviewer Role
                        </label>
                        <select
                          value={reviewerRole}
                          onChange={(e) => setReviewerRole(e.target.value)}
                          className="w-full rounded border border-input bg-background p-1.5 text-xs text-foreground"
                        >
                          <option value="qa">QA Lead</option>
                          <option value="security">Security Officer</option>
                          <option value="devops">DevOps Engineer</option>
                          <option value="cto">CTO</option>
                          <option value="pm">Product Manager</option>
                          <option value="ceo">CEO</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Verdict
                        </label>
                        <select
                          value={reviewStatus}
                          onChange={(e) => setReviewStatus(e.target.value as any)}
                          className="w-full rounded border border-input bg-background p-1.5 text-xs text-foreground"
                        >
                          <option value="approved">Approved</option>
                          <option value="changes_requested">Changes Requested</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        placeholder="Add review feedback..."
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        className="w-full rounded border border-input bg-background p-2 text-xs text-foreground focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!reviewComments.trim()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" /> Post Review
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              Select a document to inspect or edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
