// ABOUTME: Lays the presenter's own voice recordings over the recorded clips and exports the voiced video.
// ABOUTME: Never changes speech speed; it trims silence, levels loudness, and holds a clip's last frame when speech runs longer.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALIGNED, AUDIO, CLEAN, LEAD, OUT, TAIL } from './timing.ts';

const CLIPS = join(OUT, 'clips'), WORK = join(OUT, 'work', 'mix');
const LIMIT = 239.5;
mkdirSync(WORK, { recursive: true });

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${cmd} failed: ${result.stderr.slice(-600)}`);
  return result.stdout + result.stderr;
}
const ffmpeg = (args: string[]) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
const duration = (file: string) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());

const clips = readdirSync(CLIPS).filter(f => f.endsWith('.mp4')).sort();
if (!clips.length) throw new Error('No clips. Run node tools/video/run.ts first.');

const plan: { clip: string; video: number; speech: number; length: number }[] = [];
const parts: string[] = [];
for (const clip of clips) {
  const id = clip.slice(0, 2), src = join(CLIPS, clip), voice = join(AUDIO, id + '.m4a');
  const video = duration(src);
  let speech = 0;
  const voiced = join(WORK, id + '-voice.wav');
  // Use the exact audio that align.ts timed, so cues and voice share one clock.
  const aligned = join(ALIGNED, id + '.wav');
  if (existsSync(aligned)) { ffmpeg(['-i', aligned, '-c', 'copy', voiced]); speech = duration(voiced); }
  else if (existsSync(voice)) { ffmpeg(['-i', voice, '-af', CLEAN, voiced]); speech = duration(voiced); }
  const length = Math.max(video, speech ? LEAD + speech + TAIL : video);
  const out = join(WORK, clip);
  const hold = Math.max(0, length - video);
  const vf = `tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}`;
  if (speech) {
    ffmpeg(['-i', src, '-i', voiced, '-filter_complex',
      `[0:v]${vf}[v];[1:a]adelay=${Math.round(LEAD * 1000)}:all=1,apad[a]`,
      '-map', '[v]', '-map', '[a]', '-t', length.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', out]);
  } else {
    ffmpeg(['-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '192k', out]);
  }
  plan.push({ clip, video, speech, length });
  parts.push(out);
}

const total = plan.reduce((s, p) => s + p.length, 0);
const list = join(WORK, 'concat.txt');
writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
const final = join(OUT, 'devouch-demo-voiced.mp4');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', final]);

// The demo scenes alone (publish → verify → Action → withdraw → re-verify), played during the live talk.
const cutList = join(WORK, 'demo-cut.txt');
writeFileSync(cutList, parts.filter(p => /\/0[3-7]-[^/]+\.mp4$/.test(p)).map(p => `file '${p}'`).join('\n'));
const cut = join(OUT, 'devouch-demo-cut.mp4');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', cutList, '-c', 'copy', cut]);

const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
console.log('clip                      video  speech  final  held');
for (const p of plan) console.log(`${p.clip.padEnd(24)} ${p.video.toFixed(1).padStart(6)} ${p.speech.toFixed(1).padStart(7)} ${p.length.toFixed(1).padStart(6)} ${(p.length - p.video).toFixed(1).padStart(5)}`);
console.log(`Voiced video: ${final} (${mmss(duration(final))})`);
console.log(`Demo cut (scenes 03–07): ${cut} (${mmss(duration(cut))})`);
if (total > LIMIT) {
  console.error(`Over the 4:00 limit by ${(total - LIMIT).toFixed(1)} s. Shorten the scenes with the most held time.`);
  process.exitCode = 1;
}
