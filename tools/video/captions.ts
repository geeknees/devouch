// ABOUTME: Builds a silent, captioned cut of the demo scenes for presenting live or at a booth.
// ABOUTME: Captions are timed from the same narration cues that drove the recording, so they match each on-screen action.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEAD, OUT, loadTimings, phraseTime } from './timing.ts';

const MIX = join(OUT, 'work', 'mix'), WORK = join(OUT, 'work', 'captions');
const FONT = process.env.CAPTION_FONT ?? '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
mkdirSync(WORK, { recursive: true });

// Each caption starts when its cue phrase is spoken in the recorded narration (null = at the start of the clip).
const CAPTIONS: Record<string, [string | null, string][]> = {
  '03-publish': [
    [null, 'A static page. No Devouch server.'],
    ['For this recording', 'Recorded on a local chain with the official ENSv2 contracts'],
    ['I enter my ENS name', "Enter my ENS name and the contributor's GitHub ID, then review"],
    ['Signing and publishing', 'Sign, then publish: two separate steps'],
    ['The signed JSON goes', 'The signed JSON goes to my own ENSv2 resolver'],
  ],
  '04-verify': [
    [null, 'Two repositories check the same vouch'],
    ['Repo A trusts', 'Repo A trusts me: valid · accepted'],
    ["Repo B doesn't", "Repo B doesn't: valid · rejected"],
    ['The evidence is shared', 'Same evidence. Different decisions.'],
  ],
  '05-action-slot': [
    [null, 'Maintainers add two files: a policy and a workflow'],
    ['On every pull request', "On every PR, the Action checks the author's vouch"],
    ['reports the result', 'A real run on fork PR #2. Read-only, no PR code runs, no secrets.'],
  ],
  '06-revoke': [
    [null, 'Trust must be easy to take back'],
    ['I load the same endorsement', 'Load the vouch, confirm, and clear the record'],
    ['Only the issuer can do this', 'Only the issuer can do this'],
  ],
  '07-revoked': [
    [null, 'The old file is still in both repositories'],
    ['But verification reads', "Devouch reads the record's history on ENS"],
    ['so both now say revoked', 'Both now say revoked'],
    ['Writing the old JSON back', "Putting the old JSON back won't revive it"],
  ],
};

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || '').slice(-600)}`);
  return r.stdout;
}
const duration = (f: string) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

const timings = loadTimings();
const clips = Object.keys(CAPTIONS);
for (const c of clips) if (!existsSync(join(MIX, c + '.mp4'))) throw new Error(`Missing ${c}.mp4. Run node tools/video/mix.ts first.`);

// Absolute caption windows across the joined cut.
type Cue = { text: string; from: number; to: number };
const cues: Cue[] = [];
let offset = 0;
for (const clip of clips) {
  const length = duration(join(MIX, clip + '.mp4'));
  const starts = CAPTIONS[clip].map(([phrase, text]) => ({ text, at: phrase ? LEAD + phraseTime(timings[clip], clip, phrase) : 0.2 }));
  starts.forEach((s, i) => cues.push({ text: s.text, from: offset + s.at, to: offset + (i + 1 < starts.length ? starts[i + 1].at : length) - 0.1 }));
  offset += length;
}

// One transparent caption image per line, in the deck's colours.
const images = cues.map((cue, i) => {
  const file = join(WORK, `caption-${String(i).padStart(2, '0')}.png`);
  run('magick', ['-background', 'none', '-fill', '#e8ecdd', '-font', FONT, '-pointsize', '46', `label:${cue.text}`,
    '-bordercolor', '#0b0e0ad9', '-border', '34x20', '-background', 'none', '-gravity', 'center', '-extent', '%[fx:w]x%[fx:h]', file]);
  return file;
});

const list = join(WORK, 'clips.txt');
writeFileSync(list, clips.map(c => `file '${join(MIX, c + '.mp4')}'`).join('\n'));
const joined = join(WORK, 'joined.mp4');
run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-c', 'copy', joined]);

let graph = '', last = '0:v';
cues.forEach((cue, i) => {
  const next = i === cues.length - 1 ? 'v' : `v${i}`;
  graph += `[${last}][${i + 1}:v]overlay=x=(W-w)/2:y=H-h-72:enable='between(t,${cue.from.toFixed(2)},${cue.to.toFixed(2)})'[${next}];`;
  last = next;
});
const out = join(OUT, 'devouch-demo-cut-captions.mp4');
run('ffmpeg', ['-y', '-loglevel', 'error', '-i', joined, ...images.flatMap(f => ['-i', f]), '-filter_complex', graph.slice(0, -1),
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-an', out]);

const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
for (const c of cues) console.log(`${mmss(c.from).padStart(6)}–${mmss(c.to).padEnd(6)} ${c.text}`);
console.log(`Captioned silent cut: ${out} (${mmss(duration(out))})`);
