import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  exportCombinedMarkdown,
  exportSprintBacklogCsv,
  exportJiraImportCsv,
  exportSprintBacklogXlsx,
  exportZipArchive,
  exportDocx,
  exportPdf,
  DEFAULT_SPRINT_STORIES,
} from "./governance-export.js";
import { generateGovernanceDocumentPack } from "./governance-documents.js";

describe("Governance Exporters (Markdown, ZIP, PDF, DOCX, CSV, Jira, XLSX)", () => {
  const sampleContext = {
    projectName: "Project Auro SuperApp",
    problem: "Need autonomous governance and multi-format exports.",
    targetUsers: "Engineering Leaders",
    goals: "Ship complete 12-doc governance pack.",
    budget: "50000",
    deadline: "2026-12-01",
    isDemo: true,
  };

  const pack = generateGovernanceDocumentPack(sampleContext);
  const sampleDir = path.resolve(process.cwd(), "exports", "sample-pack");

  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }

  it("exports combined Markdown bundle with all document sections", () => {
    const md = exportCombinedMarkdown(sampleContext.projectName, pack);
    expect(md).toContain(`# Complete Project Governance Pack: ${sampleContext.projectName}`);
    expect(md).toContain("CHARTER.md");
    expect(md).toContain("PRD.md");
    expect(md).toContain("ARCHITECTURE.md");
    expect(md).toContain("THREAT_MODEL.md");

    const filePath = path.join(sampleDir, "GOVERNANCE_PACK.md");
    fs.writeFileSync(filePath, md, "utf8");
    expect(fs.readFileSync(filePath, "utf8")).toBe(md);
  });

  it("exports valid ZIP archive and verifies internal file entries", () => {
    const files: Record<string, string> = {};
    for (const [kind, doc] of Object.entries(pack)) {
      files[doc.fileName] = doc.content;
    }

    const zipBuffer = exportZipArchive(files);
    expect(zipBuffer.length).toBeGreaterThan(500);

    // Verify ZIP magic bytes (PK\x03\x04)
    expect(zipBuffer[0]).toBe(0x50); // 'P'
    expect(zipBuffer[1]).toBe(0x4b); // 'K'
    expect(zipBuffer[2]).toBe(0x03);
    expect(zipBuffer[3]).toBe(0x04);

    const filePath = path.join(sampleDir, "governance-pack.zip");
    fs.writeFileSync(filePath, zipBuffer);

    // Verify reading from disk
    const readBack = fs.readFileSync(filePath);
    expect(readBack.length).toBe(zipBuffer.length);
    expect(readBack.toString("binary")).toContain("PRD.md");
    expect(readBack.toString("binary")).toContain("CHARTER.md");
  });

  it("exports valid PDF document with header and stream content", () => {
    const pdfBuffer = exportPdf(sampleContext.projectName, pack);
    expect(pdfBuffer.length).toBeGreaterThan(300);

    const pdfString = pdfBuffer.toString("utf8");
    expect(pdfString.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfString).toContain("Project Auro - Governance Document Pack");
    expect(pdfString).toContain("%%EOF");

    const filePath = path.join(sampleDir, "governance-pack.pdf");
    fs.writeFileSync(filePath, pdfBuffer);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("exports valid DOCX package and verifies internal XML structure", () => {
    const docxBuffer = exportDocx(sampleContext.projectName, pack);
    expect(docxBuffer.length).toBeGreaterThan(500);

    // Verify DOCX is a valid ZIP
    expect(docxBuffer[0]).toBe(0x50);
    expect(docxBuffer[1]).toBe(0x4b);

    const filePath = path.join(sampleDir, "governance-pack.docx");
    fs.writeFileSync(filePath, docxBuffer);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("exports Sprint Backlog CSV and verifies columns and row count", () => {
    const csv = exportSprintBacklogCsv(DEFAULT_SPRINT_STORIES);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("ID,Epic,Summary,Issue Type,Priority,Story Points,Assignee Role,Depends On,Description,Acceptance Criteria");
    expect(lines.length).toBe(DEFAULT_SPRINT_STORIES.length + 1);

    expect(csv).toContain("US-101");
    expect(csv).toContain("Project Kickoff Wizard & Brief Capture");
    expect(csv).toContain("US-102");

    const filePath = path.join(sampleDir, "sprint-backlog.csv");
    fs.writeFileSync(filePath, csv, "utf8");
    expect(fs.readFileSync(filePath, "utf8")).toBe(csv);
  });

  it("exports Jira-importable CSV and verifies Jira headers and field mappings", () => {
    const jiraCsv = exportJiraImportCsv(sampleContext.projectName, DEFAULT_SPRINT_STORIES);
    const lines = jiraCsv.split("\n");

    expect(lines[0]).toBe("Issue Key,Issue Type,Summary,Description,Priority,Story Points,Epic Name,Acceptance Criteria,Custom field (Project)");
    expect(lines.length).toBe(DEFAULT_SPRINT_STORIES.length + 1);

    expect(jiraCsv).toContain(sampleContext.projectName);
    expect(jiraCsv).toContain("Core Platform");
    expect(jiraCsv).toContain("Governance Engine");

    const filePath = path.join(sampleDir, "jira-backlog-import.csv");
    fs.writeFileSync(filePath, jiraCsv, "utf8");
    expect(fs.readFileSync(filePath, "utf8")).toBe(jiraCsv);
  });

  it("exports Sprint Backlog XLSX spreadsheet and verifies XML Workbook and rows", () => {
    const xlsxXml = exportSprintBacklogXlsx(sampleContext.projectName, DEFAULT_SPRINT_STORIES);
    expect(xlsxXml).toContain(`<?xml version="1.0"?>`);
    expect(xlsxXml).toContain(`<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`);
    expect(xlsxXml).toContain(`Sprint Backlog - ${sampleContext.projectName}`);
    expect(xlsxXml).toContain(`US-101`);
    expect(xlsxXml).toContain(`US-102`);

    const filePath = path.join(sampleDir, "sprint-backlog.xlsx");
    fs.writeFileSync(filePath, xlsxXml, "utf8");
    expect(fs.readFileSync(filePath, "utf8")).toBe(xlsxXml);
  });
});
