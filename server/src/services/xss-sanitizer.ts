/**
 * Maintained XSS Sanitizer powered by DOMPurify (JSDOM runtime).
 * 
 * Provides strict, context-specific allowlists for:
 * 1. Markdown documents and previews
 * 2. Mermaid diagram code and node labels
 * 3. Lead fields (names, titles, company descriptions)
 * 4. HTML Email templates and previews
 */

import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const jsdomWindow = new JSDOM("").window;
const purify = (DOMPurify as any)(jsdomWindow as unknown as Window);

/**
 * Sanitizes Markdown HTML rendering with a strict typography and formatting allowlist.
 */
export function sanitizeMarkdown(dirty: string): string {
  if (!dirty) return "";
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "strong", "em", "strike", "s", "u",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "blockquote", "code", "pre", "hr",
      "table", "thead", "tbody", "tr", "th", "td",
      "span", "div", "details", "summary", "a",
    ],
    ALLOWED_ATTR: ["href", "title", "target", "rel", "class", "align"],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "meta", "style", "link", "svg"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });
}

/**
 * Sanitizes Mermaid diagram definitions, stripping any HTML injection or scripts in labels.
 */
export function sanitizeMermaid(dirty: string): string {
  if (!dirty) return "";
  // Strip dangerous tag blocks
  let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");
  // Neutralize inline handlers
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*['"][^'"]*['"]/gi, "");
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*[^ >]+/gi, "");
  // Neutralize javascript: pseudo protocols
  clean = clean.replace(/javascript\s*:/gi, "blocked-javascript:");
  return clean;
}

/**
 * Sanitizes lead fields (plain text only: names, companies, titles, notes).
 * Strips all HTML tags and control characters.
 */
export function sanitizeLeadField(dirty: string): string {
  if (!dirty) return "";
  const textOnly = purify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  return textOnly.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * Sanitizes HTML Email previews allowing email structural tables and safe styling attributes.
 */
export function sanitizeEmailPreview(dirty: string): string {
  if (!dirty) return "";
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "strong", "em", "u",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "blockquote", "hr",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span", "a", "img",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "target", "rel",
      "width", "height", "style", "class", "align", "valign",
      "border", "cellpadding", "cellspacing", "bgcolor",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|cid):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "meta", "svg", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/**
 * General XSS Sanitizer for backwards compatibility
 */
export function sanitizeXss(input: string): string {
  return sanitizeMarkdown(input);
}

/**
 * Escapes raw HTML entities safely
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
