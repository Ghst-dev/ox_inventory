import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render item descriptions, which are markdown.
 *
 * Sanitised rather than trusted. Descriptions originate in server Lua, but some of them
 * interpolate player-supplied text — a note written on an item, a name on a licence —
 * and that reaches this function as markdown that will be injected as HTML.
 */
export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content, { async: false }) as string);
}
