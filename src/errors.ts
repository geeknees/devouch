// ABOUTME: Defines machine-readable failures shared by the CLI bridge and wallet UI.
// ABOUTME: Keeps provider diagnostics and credential-bearing URLs out of reports.
export type EvidenceStatus = 'valid' | 'invalid' | 'missing' | 'revoked' | 'expired' | 'unavailable';

export class EvidenceError extends Error {
  constructor(public code: string, public status: EvidenceStatus = 'invalid') {
    super(code);
  }
}

export function insist(condition: unknown, code = 'invalid_format', status: EvidenceStatus = 'invalid'): asserts condition {
  if (!condition) throw new EvidenceError(code, status);
}
