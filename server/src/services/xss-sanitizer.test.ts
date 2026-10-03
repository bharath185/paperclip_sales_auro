import { describe, it, expect } from "vitest";
import { sanitizeXss, escapeHtml } from "./xss-sanitizer.js";

describe("XSS Sanitizer", () => {
  it("strips script tags and their content", () => {
    const malicious = '<p>Safe text</p><script>alert("xss")</script><p>More safe text</p>';
    const sanitized = sanitizeXss(malicious);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("alert");
    expect(sanitized).toContain("<p>Safe text</p>");
    expect(sanitized).toContain("<p>More safe text</p>");
  });

  it("neutralizes inline event handlers such as onerror and onclick", () => {
    const malicious = '<img src="missing.jpg" onerror="alert(document.cookie)" alt="avatar" />';
    const sanitized = sanitizeXss(malicious);
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("document.cookie");
    expect(sanitized).toContain('src="missing.jpg"');
  });

  it("neutralizes javascript: URIs in links and src attributes", () => {
    const maliciousLink = '<a href="javascript:alert(1)">Click me</a>';
    const sanitizedLink = sanitizeXss(maliciousLink);
    expect(sanitizedLink).not.toContain("javascript:");
    expect(sanitizedLink).toContain('href="#"');

    const maliciousSrc = '<iframe src="javascript:alert(1)"></iframe>';
    const sanitizedSrc = sanitizeXss(maliciousSrc);
    expect(sanitizedSrc).not.toContain("<iframe");
  });

  it("neutralizes data:text/html URIs in links", () => {
    const malicious = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Payload</a>';
    const sanitized = sanitizeXss(malicious);
    expect(sanitized).not.toContain("data:text/html");
    expect(sanitized).toContain('href="#"');
  });

  it("strips object, embed, and iframe elements", () => {
    const malicious = '<object data="malicious.swf"></object><embed src="bad.swf"></embed><iframe src="evil.com"></iframe>';
    const sanitized = sanitizeXss(malicious);
    expect(sanitized).not.toContain("<object");
    expect(sanitized).not.toContain("<embed");
    expect(sanitized).not.toContain("<iframe");
  });

  it("escapes raw HTML entities safely with escapeHtml", () => {
    const raw = `<script>console.log("hello & goodbye")</script>`;
    const escaped = escapeHtml(raw);
    expect(escaped).toBe("&lt;script&gt;console.log(&quot;hello &amp; goodbye&quot;)&lt;/script&gt;");
  });
});
