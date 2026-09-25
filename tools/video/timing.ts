// ABOUTME: Shares speech cleanup, placement, and script-phrase timing between the aligner, recorder, and mixer.
// ABOUTME: Falls back to an even speaking-rate estimate when no aligned voice timings exist yet.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
export const OUT = join(ROOT, 'tools/video/out');
export const AUDIO = join(OUT, 'audio');
export const ALIGNED = join(AUDIO, 'aligned');
export const TIMINGS = join(AUDIO, 'timings.json');
/** Seconds of picture before the voice starts, and after it ends, in every clip. */
export const LEAD = 0.35, TAIL = 0.45;
const WPM = 130;

/** Trim silence at both ends only, then level to -16 LUFS / -1.5 dBTP. Pauses inside speech stay as recorded. */
export const CLEAN = [
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15',
  'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15', 'areverse',
  'highpass=f=70', 'loudnorm=I=-16:TP=-1.5:LRA=11', 'aresample=48000', 'aformat=channel_layouts=stereo',
].join(',');

export const normalize = (text: string) => text.toLowerCase().replace(/[’]/g, "'").split(/[^a-z0-9']+/).filter(Boolean);

/** English narration per clip, from docs/presentation/video-script.md. */
export function scriptByClip(): Record<string, string> {
  const md = readFileSync(join(ROOT, 'docs/presentation/video-script.md'), 'utf8');
  const english = md.split('## English')[1]?.split('## 日本語')[0] ?? '';
  const out: Record<string, string[]> = {};
  let current = '';
  for (const raw of english.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('### ')) out[current = line.slice(4)] = [];
    else if (line.startsWith('> ') && current) out[current].push(line.slice(2));
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join(' ')]));
}

export type ClipTiming = { duration: number; words: { w: string; t: number }[]; source: 'aligned' | 'estimate' };

export function loadTimings(): Record<string, ClipTiming> {
  const saved: Record<string, ClipTiming> = existsSync(TIMINGS) ? JSON.parse(readFileSync(TIMINGS, 'utf8')).clips : {};
  const result: Record<string, ClipTiming> = {};
  for (const [clip, text] of Object.entries(scriptByClip())) {
    if (saved[clip]) { result[clip] = saved[clip]; continue; }
    const words = normalize(text);
    result[clip] = { duration: words.length * 60 / WPM, words: words.map((w, i) => ({ w, t: i * 60 / WPM })), source: 'estimate' };
  }
  return result;
}

/** Seconds from the voice start at which the given script phrase begins. */
export function phraseTime(timing: ClipTiming, clip: string, phrase: string) {
  const target = normalize(phrase), words = timing.words.map(x => x.w);
  for (let i = 0; i + target.length <= words.length; i++)
    if (target.every((w, j) => words[i + j] === w)) return timing.words[i].t;
  throw new Error(`Phrase "${phrase}" is not in the ${clip} narration. Update tools/video/record.ts or the video script.`);
}
