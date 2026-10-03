import { describe, it, expect } from "vitest";
import { CsvExportConnector, sanitizeCsvFormula as sanitizeSalesCsvFormula } from "./sales-crm.js";
import {
  exportSprintBacklogCsv,
  exportJiraImportCsv,
  exportSprintBacklogXlsx,
  sanitizeCsvFormula as sanitizeGovCsvFormula,
  sanitizeXmlFormula,
  type SprintStoryItem,
} from "./governance-export.js";
import type { LeadRecord } from "./sales-research.js";

describe("Formula Injection Security Hardening across all Exporters", () => {
  describe("1. Formula Injection Sanitization Helper Functions", () => {
    it("neutralizes characters that trigger spreadsheet formula evaluation (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeSalesCsvFormula("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeSalesCsvFormula("+1+1")).toBe("'+1+1");
      expect(sanitizeSalesCsvFormula("-10")).toBe("'-10");
      expect(sanitizeSalesCsvFormula("@cmd|' /C calc'!A0")).toBe("'@cmd|' /C calc'!A0");
      expect(sanitizeSalesCsvFormula("\tTAB_INJECT")).toBe("'\tTAB_INJECT");
      expect(sanitizeSalesCsvFormula("\rCR_INJECT")).toBe("'\rCR_INJECT");

      // Benign values stay unaltered
      expect(sanitizeSalesCsvFormula("Precision Aero")).toBe("Precision Aero");
      expect(sanitizeSalesCsvFormula("rajesh@company.com")).toBe("rajesh@company.com");
      expect(sanitizeSalesCsvFormula(100)).toBe("100");
    });

    it("neutralizes formula prefixes in XML/XLSX spreadsheets", () => {
      expect(sanitizeXmlFormula("=HYPERLINK(\"http://evil.com\",\"Click\")")).toBe("'=HYPERLINK(\"http://evil.com\",\"Click\")");
      expect(sanitizeXmlFormula("+CMD()")).toBe("'+CMD()");
      expect(sanitizeXmlFormula("Regular Story")).toBe("Regular Story");
    });
  });

  describe("2. Sales Leads CSV Export Formula Protection", () => {
    it("sanitizes malicious payload in lead company, contact name, and notes fields", () => {
      const maliciousLead: LeadRecord = {
        id: "lead-malicious-1",
        companyId: "comp-1",
        campaignId: "camp-1",
        companyName: "=2+5*cmd|' /C calc'!A0",
        website: "https://evil-corp.com",
        domain: "evil-corp.com",
        industry: "+Malicious Industry",
        subSegment: "-Exploit Segment",
        location: "@Bengaluru",
        companySize: "10-50",
        decisionMakerName: "=DDE(\"cmd\";\"/C calc\";\"__DdeLink__\")",
        decisionMakerTitle: "@Plant Head",
        email: "+attacker@evil-corp.com",
        phone: "+91 9999999999",
        sourceUrl: "https://evil-corp.com",
        discoveredAt: new Date().toISOString(),
        score: 90,
        status: "discovered",
      };

      const exporter = new CsvExportConnector();
      const csv = exporter.exportCsvString([maliciousLead]);

      expect(csv).not.toContain('"=2+5');
      expect(csv).toContain("\"'=2+5*cmd|' /C calc'!A0\"");
      expect(csv).toContain("\"'+Malicious Industry\"");
      expect(csv).toContain("\"'-Exploit Segment\"");
      expect(csv).toContain("\"'@Bengaluru\"");
      expect(csv).toContain("\"'=DDE(\"\"cmd\"\";\"\"/C calc\"\";\"\"__DdeLink__\"\")\"");
      expect(csv).toContain("\"'@Plant Head\"");
      expect(csv).toContain("\"'+attacker@evil-corp.com\"");
    });
  });

  describe("3. Governance Backlog & Jira CSV/XLSX Export Formula Protection", () => {
    const maliciousStories: SprintStoryItem[] = [
      {
        id: "US-999",
        epic: "=EXEC(\"powershell.exe\")",
        summary: "+Malicious Backlog Summary",
        issueType: "Story",
        description: "@Description with formula injection",
        priority: "High",
        storyPoints: 5,
        acceptanceCriteria: "-Formula in AC",
        assigneeRole: "=CTO_ROLE",
      },
    ];

    it("sanitizes formula characters in Sprint Backlog CSV", () => {
      const csv = exportSprintBacklogCsv(maliciousStories);
      expect(csv).not.toContain('"=EXEC');
      expect(csv).toContain("\"'=EXEC(\"\"powershell.exe\"\")\"");
      expect(csv).toContain("\"'+Malicious Backlog Summary\"");
      expect(csv).toContain("\"'@Description with formula injection\"");
      expect(csv).toContain("\"'-Formula in AC\"");
      expect(csv).toContain("\"'=CTO_ROLE\"");
    });

    it("sanitizes formula characters in Jira Import CSV", () => {
      const jiraCsv = exportJiraImportCsv("=ProjectAuro", maliciousStories);
      expect(jiraCsv).not.toContain('"=ProjectAuro"');
      expect(jiraCsv).toContain("\"'=ProjectAuro\"");
      expect(jiraCsv).toContain("\"'+Malicious Backlog Summary\"");
      expect(jiraCsv).toContain("\"'=EXEC(\"\"powershell.exe\"\")\"");
    });

    it("sanitizes formula characters in Sprint Backlog XLSX", () => {
      const xlsxXml = exportSprintBacklogXlsx("=ProjectAuro", maliciousStories);
      expect(xlsxXml).toContain("&apos;=ProjectAuro");
      expect(xlsxXml).toContain("&apos;=EXEC(&quot;powershell.exe&quot;)");
      expect(xlsxXml).toContain("&apos;+Malicious Backlog Summary");
      expect(xlsxXml).toContain("&apos;@Description with formula injection");
    });
  });
});
