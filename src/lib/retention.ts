export type RetentionPolicy = {
  rawEventsDays: number;
  aggregatesDays: number;
  identitiesDays: number;
};

export const defaultRetention: RetentionPolicy = {
  rawEventsDays: 90,
  aggregatesDays: 730,
  identitiesDays: 365
};

/**
 * Returns the cutoff ISO timestamp before which data should be deleted.
 * Intended for a cron / worker that calls the EventStore delete-older-than API.
 */
export function cutoffDate(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function describeCleanup(policy: RetentionPolicy = defaultRetention, now = new Date()) {
  return {
    rawEventsBefore: cutoffDate(policy.rawEventsDays, now),
    aggregatesBefore: cutoffDate(policy.aggregatesDays, now),
    identitiesBefore: cutoffDate(policy.identitiesDays, now),
    note: "Demo helpers. Wire to a scheduled job once EventStore supports delete-older-than."
  };
}
