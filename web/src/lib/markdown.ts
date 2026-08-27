import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render item descriptions, which are markdown.
 *
 * Sanitised rather than trusted. Descriptions originate in server Lua, but some of them
 * interpolate player-supplied text — a note written on an item, a name on a licence —
 * and that reaches this function as markdown that will be injected as HTML.
 *
 * NOTHING THAT REACHES OUT. Sanitising stops the script; it does not stop the *request*. Both
 * `marked` and DOMPurify's defaults are perfectly happy with `![](https://somewhere/beacon)`,
 * and a description is one of the few places a player can put a string of their own choosing —
 * so a note on an item was a way to learn who was reading it and from what address.
 *
 * Links go for the same reason and one more: this page has nowhere to navigate *to*. A click
 * would take the inventory itself off to a website and leave the player with no way back short
 * of a restart. `KEEP_CONTENT` is DOMPurify's default, so the words survive and only the anchor
 * is dropped — a description reading "see the manual" still reads that way.
 *
 * Nothing on this server's item list uses either, checked against `data/items.lua`. If a
 * description ever needs one, it needs a decision, not a quiet relaxation of this list.
 *
 * The page's CSP (see web/index.html) refuses the same requests a second time. Two layers,
 * because this one is a config object somebody could reasonably relax without noticing what it
 * was holding shut.
 */
export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content, { async: false }) as string, {
    FORBID_TAGS: ['img', 'a', 'iframe', 'object', 'embed', 'video', 'audio', 'source'],
  });
}
