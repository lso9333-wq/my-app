export const XMSK_EVAL_SCORE_MAX: Record<string, number> = {
  originInsertion: 18,
  recipeLogic: 12,
  targetStimulus: 10,
  releaseTechnique: 8,
  positionGrip: 7,
  movementCombo: 5,
  handlingFeel: 10,
  intensityCommunication: 8,
  firstImpression: 5,
  movementGuide: 5,
  privacyCare: 5,
  explanation: 4,
  closingCare: 3,
}

export const XMSK_EVAL_REQUIRED_IDS = [
  'safetyKnowledge',
  'dangerAvoidance',
  'redFlag',
  'intensityControl',
  'dangerStructures',
]

export type XmskEvalVerdict = 'approved' | 'retry' | 'hold'

export function computeXmskEvalVerdict(totalScore: number, allRequiredPassed: boolean): XmskEvalVerdict {
  if (!allRequiredPassed) return 'hold'
  if (totalScore >= 70) return 'approved'
  if (totalScore >= 60) return 'retry'
  return 'hold'
}
