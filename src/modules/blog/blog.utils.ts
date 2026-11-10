/**
 * Strips HTML vectors from markdown content before storage.
 * Covers the OWASP XSS cheat-sheet patterns most likely to survive
 * a Markdown-to-HTML render on the client.
 */
export function sanitizeMarkdown(content: string): string {
  return (
    content
      // Block elements that execute scripts
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      // SVG with inline event handlers (common bypass vector)
      .replace(/<svg\b[^>]*>[^]*?<\/svg>/gi, '')
      // Style blocks (CSS injection / data-exfiltration)
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Event handler attributes: onerror=, onload=, onclick=, etc.
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      // javascript: / vbscript: / data: URI schemes
      .replace(/(?:javascript|vbscript|data)\s*:/gi, 'removed:')
      // HTML entities that decode to javascript: (e.g. &#x6a;avascript:)
      .replace(/&#[xX]?[0-9a-fA-F]+;/g, '')
  );
}

export function calculateReadingTime(markdown: string): number {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\|/g, ' ')
    .trim();

  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
