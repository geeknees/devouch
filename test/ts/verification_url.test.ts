// ABOUTME: Checks that share links contain only the selected ENS name and optional public position.
// ABOUTME: Preserves subdirectory hosting and avoids copying unrelated query parameters into shared URLs.
import { expect, test } from 'bun:test';
import { verificationUrl } from '../../web/verify';
import { pullRequestVerificationUrl } from '../../web/verify-pr';

test('a shared verification link preserves the Pages base path and drops unrelated query fields', () => {
  expect(verificationUrl('https://geeknees.github.io/devouch/?rpc=unrelated#publish', 'masusanou-dev.eth'))
    .toBe('https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify');
});
test('a saved public position survives sharing without fetching a remote file', () => {
  const hint = { chainId: 11155111, transactionHash: `0x${'11'.repeat(32)}` as const,
    blockNumber: '11780510', blockHash: `0x${'22'.repeat(32)}` as const };
  const url = new URL(verificationUrl('https://geeknees.github.io/devouch/', 'demo.eth', hint));
  expect(JSON.parse(url.searchParams.get('publication')!)).toEqual(hint);
  expect(url.hash).toBe('#verify');
});
test('a PR share link keeps only the normalized PR URL and the hosted base path', () => {
  const url = new URL(pullRequestVerificationUrl('https://geeknees.github.io/devouch/?name=old.eth&rpc=private#publish',
    'https://github.com/geeknees/devouch/pull/2/files?ignored=true#diff'));
  expect(url.pathname).toBe('/devouch/');
  expect([...url.searchParams]).toEqual([['pr', 'https://github.com/geeknees/devouch/pull/2']]);
  expect(url.hash).toBe('#verify');
});
