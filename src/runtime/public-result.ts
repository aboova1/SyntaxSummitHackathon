import type { StudyResult } from "./types.js";

export type PublicStudyResult = Omit<StudyResult, "protectedAudit">;

export const toPublicResult = (result: StudyResult): PublicStudyResult => {
  const { protectedAudit: _protectedAudit, ...visible } = result;
  return visible;
};
