// ABOUTME: Checks remaining-day labels against the verified block time rather than a browser clock.
// ABOUTME: Covers day rounding, the seven-day warning boundary, and the exact expiry instant.
import { expect, test } from 'bun:test';
import { expirySummary } from '../../web/expiry';

const checkedAt = 1_800_000_000n, day = 86_400n;
const summary = (remaining: bigint) => expirySummary((checkedAt + remaining).toString(), checkedAt.toString());

test('remaining days use complete 24-hour periods at the supplied verification time', () => {
  expect(summary(10n * day + 3600n)).toEqual({ state: 'upcoming', text: '10 days left' });
  expect(summary(3n * day + 3600n)).toEqual({ state: 'soon', text: '3 days left' });
  expect(summary(day)).toEqual({ state: 'soon', text: '1 day left' });
});

test('the expiry warning starts exactly seven days before the signed deadline', () => {
  expect(summary(7n * day + 1n).state).toBe('upcoming');
  expect(summary(7n * day)).toEqual({ state: 'soon', text: '7 days left' });
});

test('a future deadline within 24 hours never appears as zero days or expired', () => {
  expect(summary(day - 1n)).toEqual({ state: 'soon', text: 'Less than a day left' });
  expect(summary(1n)).toEqual({ state: 'soon', text: 'Less than a day left' });
});

test('a deadline at or before the verified block is shown as expired', () => {
  expect(summary(0n)).toEqual({ state: 'expired', text: 'Expired' });
  expect(summary(-1n)).toEqual({ state: 'expired', text: 'Expired' });
  expect(summary(-3n * day)).toEqual({ state: 'expired', text: 'Expired' });
});
