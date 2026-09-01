/**
 * Player-chosen UI preferences, kept between sessions.
 *
 * WHY THIS NEEDS NO LUA. CEF gives each resource its own origin, and localStorage on
 * that origin survives a resource restart and a client restart. So a preference that
 * only changes how this UI looks never has to reach the server, be persisted in the
 * database, or become a convar — which is what makes this the cheapest per-player
 * feature in the whole backlog.
 *
 * The one caveat worth knowing: it is per *client*, not per character or per identity.
 * A player who clears their CitizenFX cache loses it, and a player on a second machine
 * starts fresh. That is the right trade for slot size and a tooltip delay; anything a
 * player would be upset to lose does not belong here.
 *
 * WHAT IS DELIBERATELY ABSENT. Background blur looks like it belongs on this list and
 * does not: the blur behind the inventory is the game engine's, raised by
 * TriggerScreenblurFadeIn in Utils.blurIn and gated on the `inventory:screenblur`
 * convar. Nothing in the browser can reach it, so offering the toggle here would be a
 * control that silently does nothing.
 */

const STORAGE_KEY = 'ghst.inventory.settings';

/**
 * Accents are a curated set rather than a colour picker.
 *
 * tokens.css is explicit that the two-tier cyan is what makes the palette read as
 * chosen rather than as "some blue": --color-primary for anything at rest, --color-action
 * for the moment something happens. A free picker would hand out one colour and leave the
 * second stuck on cyan, so each option carries its own pair.
 */
export interface Accent {
  id: string;
  label: string;
  /**
   * `null` is the theme's own pair, and the override is removed rather than written.
   *
   * This used to carry `'#22d3ee'` / `'#00e5ff'` -- a second copy of what `theme/tokens.css`
   * already says, in a file no colour gate could see. It was right on the day it was typed and
   * would have gone on calling itself "Ghst" while being some other cyan the moment the token
   * moved, which is exactly the drift `copies.py` exists to stop between resources, happening
   * inside one. `Tools/checks/literals.py` found it by matching the value.
   */
  primary: string | null;
  action: string | null;
}

export const ACCENTS: Accent[] = [
  { id: 'ghst', label: 'Ghst', primary: null, action: null },
  { id: 'lime', label: 'Lime', primary: '#a3e635', action: '#bef264' },
  { id: 'amber', label: 'Amber', primary: '#fbbf24', action: '#fcd34d' },
  { id: 'rose', label: 'Rose', primary: '#fb7185', action: '#fda4af' },
  { id: 'violet', label: 'Violet', primary: '#a78bfa', action: '#c4b5fd' },
  /* @literal-ok a monochrome preset's live tier is white by definition, not the ink token */
  { id: 'plain', label: 'Plain', primary: '#d4d4d4', action: '#ffffff' },
];

/**
 * When the hotbar is on screen.
 *
 * `flash` is the stock behaviour — three seconds on the hotbar key, then gone. `always`
 * leaves it up for the whole session, which is what most survival games do and what makes
 * the change-pulse below worth having.
 */
export const HOTBAR_MODES = ['flash', 'always'] as const;
export type HotbarMode = (typeof HOTBAR_MODES)[number];

export interface Settings {
  accent: string;
  hotbar: HotbarMode;
  /** Multiplier on --slot-size, so the vh clamp that keeps it sane at 720p and 4K survives. */
  scale: number;
  /** Milliseconds of hover before a tooltip opens. 0 means immediately. */
  tooltipDelay: number;
}

/*
 * `reduceMotion` and `volume` used to live here, and they moved to `lib/prefs.svelte.ts`.
 *
 * They were never inventory settings. Reduce motion is a statement about the player, and this
 * page's switch reached this page while the character screen's identical switch reached that one
 * -- two owners, neither aware of the other, and a player who set it in one place watching the
 * other ignore them. Volume is the same shape of problem one step earlier: two UIs made noise,
 * each with its own idea of how loud.
 *
 * What is left here is genuinely local: an accent, a slot size, a hover delay. Those describe this
 * inventory and nothing else, and they stay in localStorage where they were.
 */

const DEFAULTS: Settings = {
  accent: 'ghst',
  hotbar: 'flash',
  scale: 1,
  tooltipDelay: 500,
};

export const SCALE_RANGE = { min: 0.8, max: 1.3, step: 0.05 };
export const DELAY_RANGE = { min: 0, max: 1200, step: 100 };

/**
 * Read what is stored, keeping only keys that still exist and values of the right shape.
 *
 * Storage is the last session's data, written by a build that may be older than this one:
 * a setting can have been removed, renamed or had its type changed since. Merging onto
 * DEFAULTS field by field means an unknown or malformed key is dropped rather than
 * poisoning the store — and a corrupt blob costs the defaults, not a broken inventory.
 */
function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };

    const stored = JSON.parse(raw) as Partial<Settings>;

    return {
      accent: ACCENTS.some((a) => a.id === stored.accent) ? stored.accent! : DEFAULTS.accent,
      hotbar: HOTBAR_MODES.includes(stored.hotbar!) ? stored.hotbar! : DEFAULTS.hotbar,
      scale: clamp(stored.scale, SCALE_RANGE.min, SCALE_RANGE.max, DEFAULTS.scale),
      tooltipDelay: clamp(stored.tooltipDelay, DELAY_RANGE.min, DELAY_RANGE.max, DEFAULTS.tooltipDelay),
    };
  } catch {
    // Private-mode storage, a quota error, or a half-written blob. None of them are worth
    // failing the inventory over.
    return { ...DEFAULTS };
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export const settings = $state<Settings>(load());

export function reset(): void {
  Object.assign(settings, DEFAULTS);
}

export const accent = () => ACCENTS.find((a) => a.id === settings.accent) ?? ACCENTS[0];

/**
 * Write the chosen values onto the document, and persist them.
 *
 * Set on documentElement rather than in a stylesheet so they override the :root block in
 * tokens.css by specificity without that file having to know this feature exists — and so
 * removing a setting removes its effect completely, rather than leaving a dead rule.
 *
 * Call once from App; it is an $effect, so every later change follows.
 */
export function applySettings(): void {
  $effect(() => {
    const style = document.documentElement.style;
    const chosen = accent();

    if (chosen.primary && chosen.action) {
      style.setProperty('--color-primary', chosen.primary);
      style.setProperty('--color-action', chosen.action);

      // The glow tints are the accent at fixed alphas, and they are used as borders and
      // rings all over the UI. Left alone they would stay cyan while everything else moved.
      style.setProperty('--primary-glow', hexToRgba(chosen.primary, 0.08));
      style.setProperty('--primary-glow-border', hexToRgba(chosen.primary, 0.25));
      style.setProperty('--action-glow', hexToRgba(chosen.action, 0.35));

      // And the selected state layer, which is the accent at 14% and was missed when the state
      // layers landed: every other surface followed the chosen accent while "this one is
      // selected" stayed cyan. Found while removing the duplicated Ghst pair above.
      style.setProperty('--state-selected', hexToRgba(chosen.primary, 0.14));
    } else {
      // The theme's own. REMOVED rather than re-set to the same hex, which is what this
      // function's own comment above already said it wanted: removing a setting should remove
      // its effect completely rather than leave a dead rule saying the same thing twice.
      for (const name of ACCENT_PROPERTIES) style.removeProperty(name);
    }

    // Only the scalar. app.css owns the formula, because a three-pane row multiplies the
    // same base again for its own reasons and a --slot-size written whole from here could
    // not be re-derived further down the tree — a custom property is substituted where it
    // is declared, not where it is read.
    style.setProperty('--slot-scale', String(settings.scale));

    /* No `data-reduce-motion` here any more. `lib/prefs.svelte.ts` owns that attribute for every
       ghst UI, and two writers of one attribute is what the shared transport exists to end. */

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be full or unavailable. The settings still apply for this session;
      // they simply will not be there next time, which is better than throwing.
    }
  });
}

/** Everything an accent overrides, so choosing the theme's own can put all of it back. */
const ACCENT_PROPERTIES = [
  '--color-primary',
  '--color-action',
  '--primary-glow',
  '--primary-glow-border',
  '--action-glow',
  '--state-selected',
];

/** #rrggbb to rgba(). The accents above are all six-digit hex, so nothing else is handled. */
function hexToRgba(hex: string, alpha: number): string {
  const int = parseInt(hex.slice(1), 16);

  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}
