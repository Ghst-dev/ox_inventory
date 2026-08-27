/**
 * The inventory's own sounds, synthesised rather than shipped.
 *
 * WHY THERE ARE NO AUDIO FILES. fxmanifest.lua's `files` block globs exactly two things
 * out of the built bundle — `web/build/assets/*.js` and `*.css`. A loose .ogg or .wav
 * next to them is not published by the resource and 404s in game, so the only way to ship
 * a recorded clip is to base64 it into the JS chunk. Six short clips is tens of kilobytes
 * of unreadable string constant that nobody can adjust without re-encoding.
 *
 * These are built from oscillators and filtered noise instead. Nothing is added to the
 * bundle but this file, every sound is a handful of numbers, and changing one is editing
 * a frequency rather than finding an audio editor. UI blips, thunks and refusals are
 * exactly the class of sound synthesis is good at; a voice line or a gunshot would not be.
 *
 * TUNING. Each entry below is (roughly) pitch, shape, length and loudness. The individual
 * `gain` figures are relative to each other and then scaled by the player's volume
 * setting, so raising one in isolation makes it louder *against the others* — which is
 * usually what you want, but is worth knowing before nudging them.
 */

import { prefs } from './prefs.svelte';

export type SoundName = 'open' | 'close' | 'pickup' | 'drop' | 'deny';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/**
 * The context is created on first use and never torn down.
 *
 * Chromium refuses to start one before a user gesture and leaves it `suspended`; whether
 * CEF enforces that in FiveM depends on the flags the client was launched with, so this
 * resumes on every play rather than assuming either way. Resuming an already-running
 * context is free.
 */
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }

    if (ctx.state === 'suspended') void ctx.resume();

    return ctx;
  } catch {
    // No Web Audio at all. Sound is decoration; the inventory is not.
    return null;
  }
}

/**
 * An amplitude envelope, applied to whatever is connected through it.
 *
 * The decay is exponential because a linear fade to zero on a short click is audible as a
 * flat cut. It ramps to 0.0001 rather than 0 because exponentialRampToValueAtTime is
 * undefined at zero.
 */
function envelope(context: AudioContext, at: number, peak: number, attack: number, length: number) {
  const gain = context.createGain();

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

  return gain;
}

interface ToneOptions {
  /** Starting frequency in Hz. */
  from: number;
  /** Frequency to glide to over the life of the note. Defaults to no glide. */
  to?: number;
  type?: OscillatorType;
  /** Seconds. */
  length: number;
  gain: number;
  /** Seconds before the note reaches full loudness. Short is percussive. */
  attack?: number;
  /** Seconds to wait before starting. */
  delay?: number;
}

function tone(context: AudioContext, target: AudioNode, options: ToneOptions) {
  const at = context.currentTime + (options.delay ?? 0);
  const osc = context.createOscillator();

  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.from, at);

  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, at + options.length);

  const env = envelope(context, at, options.gain, options.attack ?? 0.005, options.length);

  osc.connect(env).connect(target);
  osc.start(at);
  osc.stop(at + options.length + 0.02);
}

/**
 * A burst of white noise behind a sweeping low-pass — the body of anything that thuds,
 * clicks or slides. Written into a one-shot buffer rather than generated continuously
 * because these are all well under a fifth of a second.
 */
function noise(
  context: AudioContext,
  target: AudioNode,
  options: { length: number; gain: number; from: number; to: number; delay?: number },
) {
  const at = context.currentTime + (options.delay ?? 0);
  const frames = Math.max(1, Math.floor(context.sampleRate * options.length));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(options.from, at);
  filter.frequency.exponentialRampToValueAtTime(options.to, at + options.length);

  const env = envelope(context, at, options.gain, 0.004, options.length);

  source.connect(filter).connect(env).connect(target);
  source.start(at);
}

/**
 * The set.
 *
 * `open` and `close` are the same gesture in opposite directions, which is what makes a
 * pair of them read as one thing opening and closing rather than as two unrelated noises.
 * `deny` is two descending blips because a single low tone is heard as a thud — the
 * second, lower note is what turns it into "no".
 */
const SOUNDS: Record<SoundName, (context: AudioContext, out: AudioNode) => void> = {
  open: (c, out) => {
    noise(c, out, { length: 0.09, gain: 0.16, from: 500, to: 2600 });
    tone(c, out, { from: 480, to: 720, length: 0.07, gain: 0.05, type: 'sine' });
  },

  close: (c, out) => {
    noise(c, out, { length: 0.11, gain: 0.14, from: 2400, to: 420 });
    tone(c, out, { from: 620, to: 380, length: 0.08, gain: 0.04, type: 'sine' });
  },

  pickup: (c, out) => {
    tone(c, out, { from: 520, to: 660, length: 0.045, gain: 0.09, type: 'sine' });
  },

  drop: (c, out) => {
    tone(c, out, { from: 210, to: 120, length: 0.09, gain: 0.15, type: 'sine' });
    noise(c, out, { length: 0.05, gain: 0.05, from: 1400, to: 400 });
  },

  deny: (c, out) => {
    tone(c, out, { from: 330, length: 0.06, gain: 0.1, type: 'triangle' });
    tone(c, out, { from: 240, length: 0.09, gain: 0.1, type: 'triangle', delay: 0.07 });
  },
};

/**
 * Play one, if the player wants sound at all.
 *
 * Volume 0 returns before touching Web Audio, so a player who has turned sound off never
 * has an AudioContext created on their behalf.
 */
export function play(name: SoundName): void {
  const volume = prefs.uiVolume;

  if (!volume) return;

  const context = audio();
  if (!context || !master) return;

  // Squared so the slider behaves the way a volume slider should: halfway sounds like
  // half, rather than like most of the way up.
  master.gain.value = volume * volume;

  try {
    SOUNDS[name](context, master);
  } catch {
    // A sound that fails to build is not worth interrupting a move over.
  }
}
