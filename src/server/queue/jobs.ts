/**
 * BullMQ / Redis job skeleton.
 * Production: replace with real Queue/Worker once Redis is available.
 */

export type JobName = "retention-cleanup" | "daily-aggregate" | "gdpr-delete";

export type JobPayload = {
  projectId: string;
  cutoff?: string;
  personId?: string;
};

export async function enqueue(name: JobName, payload: JobPayload) {
  // Placeholder — in production this calls bullmq Queue.add
  console.log(`[queue] enqueued ${name}`, payload);
  return { id: `job_${Date.now()}`, name, payload, status: "queued" as const };
}

export const jobNote = "Wire to Redis + BullMQ when the production EventStore is live.";
