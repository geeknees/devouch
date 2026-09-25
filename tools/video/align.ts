// ABOUTME: Finds when each word of the video script is spoken in the presenter's recordings, using local whisper.cpp.
// ABOUTME: Aligns the script to the transcript so recognition errors do not move cues; writes out/audio/timings.json.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ALIGNED, AUDIO, CLEAN, TIMINGS, normalize, scriptByClip, type ClipTiming } from './timing.ts';

const MODEL = process.env.WHISPER_MODEL ?? join(homedir(), '.cache/whisper-cpp/ggml-base.en.bin');
if (!existsSync(MODEL)) throw new Error(`Whisper model not found at ${MODEL}. See tools/video/README.md.`);
mkdirSync(ALIGNED, { recursive: true });

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || '').slice(-600)}`);
  return r.stdout;
}
const duration = (f: string) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

type Heard = { w: string; t: number };
function transcribe(wav16: string, base: string): Heard[] {
  run('whisper-cli', ['-m', MODEL, '-f', wav16, '-ojf', '-of', base, '-np']);
  const json = JSON.parse(readFileSync(base + '.json', 'utf8')) as { transcription: { tokens: { text: string; offsets: { from: number } }[] }[] };
  const heard: Heard[] = [];
  for (const segment of json.transcription) for (const token of segment.tokens) {
    if (token.text.startsWith('[_')) continue;
    const pieces = normalize(token.text);
    if (!pieces.length) continue;
    const t = token.offsets.from / 1000;
    // A token that starts with a space begins a new word; otherwise it continues the previous word.
    if (!token.text.startsWith(' ') && heard.length) { heard.at(-1)!.w += pieces[0]; heard.push(...pieces.slice(1).map(w => ({ w, t }))); }
    else heard.push(...pieces.map(w => ({ w, t })));
  }
  return heard;
}

function similarity(a: string, b: string) {
  if (a === b) return 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

/** Global alignment of script words to heard words; returns the heard index for each script word, or -1. */
function align(script: string[], heard: Heard[]) {
  const n = script.length, m = heard.length, GAP = 0.8;
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { cost[i][0] = i * GAP; move[i][0] = 1; }
  for (let j = 1; j <= m; j++) { cost[0][j] = j * GAP; move[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = similarity(script[i - 1], heard[j - 1].w);
    const options = [cost[i - 1][j - 1] + (s >= .5 ? 1 - s : 1.3), cost[i - 1][j] + GAP, cost[i][j - 1] + GAP];
    const best = options.indexOf(Math.min(...options));
    cost[i][j] = options[best]; move[i][j] = best;
  }
  const match = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const mv = i > 0 && j > 0 ? move[i][j] : i > 0 ? 1 : 2;
    if (mv === 0) { if (similarity(script[i - 1], heard[j - 1].w) >= .5) match[i - 1] = j - 1; i--; j--; }
    else if (mv === 1) i--; else j--;
  }
  return match;
}

const clips: Record<string, ClipTiming> = {};
for (const [clip, text] of Object.entries(scriptByClip())) {
  const id = clip.slice(0, 2), voice = join(AUDIO, id + '.m4a');
  if (!existsSync(voice)) { console.log(`${clip}: no recording, skipped`); continue; }
  const cleaned = join(ALIGNED, id + '.wav'), wav16 = join(ALIGNED, id + '-16k.wav');
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', voice, '-af', CLEAN, cleaned]);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', cleaned, '-ar', '16000', '-ac', '1', wav16]);
  const length = duration(cleaned);
  const heard = transcribe(wav16, join(ALIGNED, id));
  const script = normalize(text);
  const match = align(script, heard);
  // Matched words take their heard time; the rest are interpolated between matched neighbours.
  const known = match.map((j, i) => j >= 0 ? [i, heard[j].t] as const : null).filter(Boolean) as (readonly [number, number])[];
  const anchors = [[-1, 0] as const, ...known, [script.length, length] as const];
  const words = script.map((w, i) => {
    const hit = match[i] >= 0 ? heard[match[i]].t : null;
    if (hit !== null) return { w, t: +hit.toFixed(3) };
    const after = anchors.findIndex(([k]) => k > i), [i0, t0] = anchors[after - 1], [i1, t1] = anchors[after];
    return { w, t: +(t0 + (t1 - t0) * (i - i0) / (i1 - i0)).toFixed(3) };
  });
  for (let i = 1; i < words.length; i++) if (words[i].t < words[i - 1].t) words[i].t = words[i - 1].t;
  clips[clip] = { duration: +length.toFixed(3), words, source: 'aligned' };
  const rate = Math.round(100 * known.length / script.length);
  console.log(`\n${clip}  ${length.toFixed(1)} s  matched ${rate}% of script words`);
  const sentences = text.split(/(?<=[.!?])\s+/);
  let k = 0;
  for (const s of sentences) { console.log(`  ${words[k].t.toFixed(2).padStart(6)}  ${s}`); k += normalize(s).length; }
}
writeFileSync(TIMINGS, JSON.stringify({ model: MODEL.split('/').at(-1), clips }, null, 1));
console.log(`\nWrote ${TIMINGS}. Edit a time there if a cue lands on the wrong word, then run tools/video/run.ts.`);
