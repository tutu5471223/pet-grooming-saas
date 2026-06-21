import sanitizeHtml from "sanitize-html"

// Allowlist sanitizer for shop-authored contract templates.
//
// Contract templates are HTML written by a shop owner and rendered on PUBLIC
// pages (contract signing / registration) via dangerouslySetInnerHTML. Without
// sanitization a malicious or compromised shop account could inject <script>
// (stored XSS) that runs in every customer's browser.
//
// IMPORTANT: this module pulls in the server-only `sanitize-html` parser. Call
// it ONLY in server contexts (route handlers, server components). Client
// components must receive already-sanitized HTML as props.

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "strong", "em", "b", "i", "u", "s",
    "ul", "ol", "li", "blockquote", "span", "div",
    "a", "table", "thead", "tbody", "tr", "td", "th",
  ],
  allowedAttributes: {
    a: ["href", "name", "target"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // Force safe rel on links; disallow javascript: via allowedSchemes above.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
    }),
  },
  // Drop any disallowed tag entirely (including its text) for <script>/<style>.
  nonTextTags: ["script", "style", "textarea", "noscript", "iframe", "object", "embed"],
}

/** Sanitize shop-authored contract HTML before storing AND before rendering. */
export function sanitizeContractHtml(dirty: string | null | undefined): string {
  if (!dirty) return ""
  return sanitizeHtml(dirty, OPTIONS)
}
