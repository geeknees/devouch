// ABOUTME: Reads public GitHub PR identity and bounded JSON files at immutable commit SHAs.
// ABOUTME: Uses anonymous GET requests to a fixed origin without redirects or repository execution.
import { object, strictJson } from './credential';

const ORIGIN = 'https://api.github.com';
const REPOSITORY = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?![\s\S])/;
const SHA = /^[0-9a-f]{40}(?![\s\S])/;
const repository = (value: unknown): value is string => typeof value === 'string' && REPOSITORY.test(value)
  && value.split('/').every(part => part !== '.' && part !== '..');
type Fetcher = (url: string, options: RequestInit) => Promise<Response>;
export class GitHubError extends Error {
  constructor(public code: string) { super(code); }
}
export type PullRequest = { repository: string; number: number; url: string; authorId: string; authorLogin: string;
  baseSha: string; headSha: string; headRepository: string };

export function parsePullRequestUrl(input: string) {
  try {
    const value = input.trim();
    if (value.length > 2048 || /[\s\\]/.test(value) || /\/\.{1,2}(?:\/|[?#]|$)/.test(value)) throw new Error();
    const url = new URL(value);
    const match = url.pathname.match(/^\/([a-zA-Z0-9_.-]+\/[-a-zA-Z0-9_.]+)\/pull\/([1-9][0-9]*)(?:\/(?:files|commits|checks))?\/?$/);
    if (url.origin !== 'https://github.com' || url.username || url.password || !match || !repository(match[1])) throw new Error();
    const number = Number(match[2]);
    if (!Number.isSafeInteger(number)) throw new Error();
    return { repository: match[1], number, url: `https://github.com/${match[1]}/pull/${number}` };
  } catch { throw new GitHubError('invalid_pr_url'); }
}

export class GitHubReader {
  constructor(private fetcher: Fetcher = (url, options) => fetch(url, options)) {}

  private async get(path: string, missing: boolean, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
    try {
      const timeout = AbortSignal.timeout(20_000);
      const response = await this.fetcher(ORIGIN + path, { method: 'GET', credentials: 'omit', redirect: 'error',
        cache: 'no-store', referrerPolicy: 'no-referrer', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
      if (response.status === 404 && missing) return null;
      if (response.status === 404) throw new GitHubError('github_pr_unavailable');
      if (response.status === 429 || (response.status === 403
        && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')))) {
        throw new GitHubError('github_rate_limited');
      }
      if (response.status !== 200 || !response.body) throw new GitHubError('github_unavailable');
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1_048_576) { await reader.cancel(); throw new GitHubError('github_response_too_large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      try { return object(strictJson(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), 1_048_576)); }
      catch { throw new GitHubError('github_response_invalid'); }
    } catch (error) {
      if (error instanceof GitHubError) throw error;
      throw new GitHubError('github_unavailable');
    }
  }

  async pullRequest(input: string, signal?: AbortSignal): Promise<PullRequest> {
    const selected = parsePullRequestUrl(input);
    const value = await this.get(`/repos/${selected.repository}/pulls/${selected.number}`, false, signal);
    try {
      const pr = object(value), user = object(pr.user), base = object(pr.base), head = object(pr.head);
      const baseRepo = object(base.repo).full_name, headRepo = object(head.repo).full_name;
      if (pr.number !== selected.number || !repository(baseRepo) || baseRepo.toLowerCase() !== selected.repository.toLowerCase()
        || !repository(headRepo) || typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0
        || typeof user.login !== 'string' || user.login.length > 100 || !/^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\[bot\])?$/.test(user.login)
        || typeof base.sha !== 'string' || !SHA.test(base.sha) || typeof head.sha !== 'string' || !SHA.test(head.sha)) throw new Error();
      return { repository: baseRepo, number: selected.number, url: `https://github.com/${baseRepo}/pull/${selected.number}`,
        authorId: String(user.id), authorLogin: user.login, baseSha: base.sha, headSha: head.sha, headRepository: headRepo };
    } catch { throw new GitHubError('invalid_pr_metadata'); }
  }

  async file(repo: string, path: string, sha: string, limit: number, signal?: AbortSignal): Promise<string | null> {
    if (!repository(repo) || !SHA.test(sha) || !/^\.devouch\/(?:policy|vouches\/github-[1-9][0-9]*)\.json$/.test(path)
      || !Number.isSafeInteger(limit) || limit <= 0 || limit > 16_384) throw new GitHubError('github_file_invalid');
    const record = await this.get(`/repos/${repo}/contents/${path}?ref=${sha}`, true, signal);
    if (record === null) return null;
    try {
      if (record.type !== 'file' || record.encoding !== 'base64' || typeof record.size !== 'number'
        || !Number.isSafeInteger(record.size) || record.size < 0 || record.size > limit || typeof record.content !== 'string') throw new Error();
      const compact = record.content.replaceAll('\n', '');
      if (compact.length > 4 * Math.ceil(limit / 3)) throw new Error();
      const binary = atob(compact);
      if (btoa(binary) !== compact || binary.length !== record.size) throw new Error();
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
    } catch { throw new GitHubError('github_file_invalid'); }
  }
}
