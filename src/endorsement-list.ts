// ABOUTME: Stores bounded publication names and recovers saved endorsements after an empty current record.
// ABOUTME: Keeps verified results transient and delegates every evidence decision to the shared reader.
import type { Publication } from './chain';
import { strictJson } from './credential';
import { nameParts } from './ens';
import { EvidenceError, insist } from './errors';
import { publicationHint } from './operations';

export type SavedName = { name: string; publication?: Publication };
export const SAVED_NAME_LIMIT = 8;
export const SAVED_NAMES_KEY = 'devouch.saved-names.v1';

export function addSavedName(names: SavedName[], name: string, publication?: Publication): SavedName[] {
  nameParts(name);
  insist(!names.some(row => row.name === name), 'name_already_saved');
  insist(names.length < SAVED_NAME_LIMIT, 'saved_name_limit');
  return [...names, { name, ...(publication ? { publication: publicationHint(publication) } : {}) }];
}

export function parseSavedNames(raw: string): SavedName[] {
  const value = strictJson(raw, 16384) as Record<string, unknown>;
  insist(value && typeof value === 'object' && !Array.isArray(value) && value.version === 1
    && Object.keys(value).sort().join(',') === 'names,version' && Array.isArray(value.names), 'invalid_saved_names');
  let names: SavedName[] = [];
  for (const row of value.names) {
    insist(row && typeof row === 'object' && !Array.isArray(row) && typeof row.name === 'string'
      && Object.keys(row).every(key => ['name', 'publication'].includes(key)), 'invalid_saved_names');
    names = addSavedName(names, row.name, row.publication === undefined ? undefined : publicationHint(row.publication));
  }
  return names;
}

export async function inspectSavedName<T>(saved: SavedName, verify: (name: string, publication?: Publication) => Promise<T>) {
  try { return { verified: await verify(saved.name), usedSavedPublication: false }; }
  catch (error) {
    if (!(error instanceof EvidenceError) || error.status !== 'missing' || !saved.publication) throw error;
    return { verified: await verify(saved.name, saved.publication), usedSavedPublication: true };
  }
}
