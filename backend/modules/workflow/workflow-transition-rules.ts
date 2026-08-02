import { ContentStage } from "@prisma/client";

export const workflowTransitionRules: Record<ContentStage, ContentStage[]> = {
  [ContentStage.IDEA]: [ContentStage.WRITING],
  [ContentStage.WRITING]: [ContentStage.MANAGER_SCRIPT_REVIEW],
  [ContentStage.MANAGER_SCRIPT_REVIEW]: [
    ContentStage.SHOOT,
    ContentStage.EDITING,
  ],
  [ContentStage.SHOOT]: [ContentStage.EDITOR_INTAKE],
  [ContentStage.EDITOR_INTAKE]: [ContentStage.EDITING],
  [ContentStage.EDITING]: [ContentStage.MANAGER_EDIT_REVIEW],
  [ContentStage.MANAGER_EDIT_REVIEW]: [
    ContentStage.CLIENT_APPROVAL,
    ContentStage.ARCHIVED,
  ],
  [ContentStage.CLIENT_APPROVAL]: [
    ContentStage.SCHEDULED,
    ContentStage.ARCHIVED,
  ],
  [ContentStage.SCHEDULED]: [ContentStage.PUBLISHED, ContentStage.ARCHIVED],
  [ContentStage.PUBLISHED]: [ContentStage.ARCHIVED],
  [ContentStage.ARCHIVED]: [],
};

export function canTransition(
  fromStage: ContentStage | null | undefined,
  toStage: ContentStage,
): boolean {
  if (!fromStage) {
    return toStage === ContentStage.IDEA;
  }

  return workflowTransitionRules[fromStage]?.includes(toStage) ?? false;
}
