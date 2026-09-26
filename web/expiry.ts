// ABOUTME: Formats time remaining until a signed endorsement expires at the verified block.
// ABOUTME: Marks approaching deadlines without making or replacing an evidence or policy decision.
export function expirySummary(expiresAt: string, snapshotTimestamp: string): {
  state: 'upcoming' | 'soon' | 'expired'; text: string;
} {
  const remaining = BigInt(expiresAt) - BigInt(snapshotTimestamp), day = 86_400n;
  if (remaining <= 0n) return { state: 'expired', text: 'Expired' };
  const days = remaining / day;
  return {
    state: remaining <= 7n * day ? 'soon' : 'upcoming',
    text: days === 0n ? 'Less than a day left' : `${days} ${days === 1n ? 'day' : 'days'} left`,
  };
}
