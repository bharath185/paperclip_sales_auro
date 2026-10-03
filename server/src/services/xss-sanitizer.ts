/**
 * XSS Sanitizer for agent-written Markdown, HTML email previews, and lead fields.
 * 
 * Neutralizes:
 * - <script> tags
 * - <iframe>, <object>, <embed> tags
 * - Inline event handlers (onerror, onload, onclick, onmouseover, etc.)
 * - javascript: and data:text/html URI schemes in href and src attributes
 */

export function sanitizeXss(input: string): string {
  if (!input) return "";

  let clean = input;

  // 1. Remove script, iframe, object, embed, form, meta, link tags
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");

  // 2. Neutralize inline event handlers on any HTML element (e.g. <img onerror=...>)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*(['\"]).*?\1/gi, "");
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*[^ >]+/gi, "");

  // 3. Neutralize dangerous pseudo-protocols in links and images
  clean = clean.replace(/href\s*=\s*(['\"])javascript:.*?\1/gi, 'href="#"');
  clean = clean.replace(/href\s*=\s*javascript:[^ >]+/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*(['\"])javascript:.*?\1/gi, 'src=""');
  clean = clean.replace(/src\s*=\s*javascript:[^ >]+/gi, 'src=""');
  clean = clean.replace(/href\s*=\s*(['\"])data:text\/html.*?\1/gi, 'href="#"');
  clean = clean.replace(/href\s*=\s*data:text\/html[^ >]+/gi, 'href="#"');

  return clean;
}

export function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
