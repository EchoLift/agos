import { ContentStage } from '@prisma/client';
import { canTransition } from './workflow-transition-rules';

describe('workflow transition rules', () => {
  it('allows the initial transition into idea', () => {
    expect(canTransition(null, ContentStage.IDEA)).toBe(true);
  });

  it('allows the standard writing flow', () => {
    expect(canTransition(ContentStage.IDEA, ContentStage.WRITING)).toBe(true);
    expect(canTransition(ContentStage.WRITING, ContentStage.MANAGER_SCRIPT_REVIEW)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition(ContentStage.IDEA, ContentStage.PUBLISHED)).toBe(false);
  });
});
