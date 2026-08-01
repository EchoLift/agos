import { SubmissionStatus } from '@prisma/client';

export interface MarkSubmissionSeenInput {
  actorId: string;
}

export function buildSubmissionReviewState(status: SubmissionStatus) {
  return status === SubmissionStatus.SUBMITTED ? 'waiting_review' : 'reviewed';
}
