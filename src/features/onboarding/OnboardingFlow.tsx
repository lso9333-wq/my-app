import { useState } from 'react';

// 실제 프로젝트의 버튼/입력 컴포넌트, 타입 정의 위치에 맞춰 import 경로를 조정해야 함.
// 이 파일은 draft이며, 기존 features 폴더 컨벤션(다른 feature의 lib/components를 import하지 않음)을 따름.

export type GoalType = 'bp' | 'glucose' | 'weight' | 'medication';
export type ConditionType = 'hypertension' | 'diabetes' | 'hyperlipidemia' | 'none';
export type CoachingTone = 'friendly' | 'formal';

export interface OnboardingResult {
  goals: GoalType[];
  conditions: ConditionType[];
  ageRange: string;
  heightCm: number | null;
  weightKg: number | null;
  notifyHour: number;
  coachingTone: CoachingTone;
}

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'bp', label: '혈압 관리' },
  { value: 'glucose', label: '혈당 관리' },
  { value: 'weight', label: '체중 관리' },
  { value: 'medication', label: '복약 순응도 향상' },
];

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'hypertension', label: '고혈압' },
  { value: 'diabetes', label: '당뇨' },
  { value: 'hyperlipidemia', label: '고지혈증' },
  { value: 'none', label: '해당 없음' },
];

interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<GoalType[]>([]);
  const [conditions, setConditions] = useState<ConditionType[]>([]);
  const [ageRange, setAgeRange] = useState('');
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [notifyHour, setNotifyHour] = useState(9);
  const [coachingTone, setCoachingTone] = useState<CoachingTone>('friendly');

  const toggleGoal = (value: GoalType) => {
    setGoals((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]
    );
  };

  const toggleCondition = (value: ConditionType) => {
    setConditions((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const canProceed = () => {
    if (step === 0) return goals.length > 0;
    if (step === 1) return conditions.length > 0;
    if (step === 2) return ageRange !== '';
    return true;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    onComplete({
      goals,
      conditions,
      ageRange,
      heightCm,
      weightKg,
      notifyHour,
      coachingTone,
    });
  };

  return (
    <div className="onboarding-flow">
      {step === 0 && (
        <div className="onboarding-step">
          <h2>건강 목표를 선택해주세요</h2>
          <p className="onboarding-subtitle">하나 이상 고를 수 있어요.</p>
          <div className="onboarding-options">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={goals.includes(opt.value) ? 'option-selected' : 'option'}
                onClick={() => toggleGoal(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <h2>진단받은 만성질환이 있나요?</h2>
          <div className="onboarding-options">
            {CONDITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={conditions.includes(opt.value) ? 'option-selected' : 'option'}
                onClick={() => toggleCondition(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <h2>기본 정보를 알려주세요</h2>
          <label>
            연령대
            <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
              <option value="">선택</option>
              <option value="20s">20대</option>
              <option value="30s">30대</option>
              <option value="40s">40대</option>
              <option value="50s">50대</option>
              <option value="60plus">60대 이상</option>
            </select>
          </label>
          <label>
            키(cm)
            <input
              type="number"
              value={heightCm ?? ''}
              onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label>
            몸무게(kg)
            <input
              type="number"
              value={weightKg ?? ''}
              onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : null)}
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-step">
          <h2>알림과 코칭 스타일을 정해주세요</h2>
          <label>
            알림 받고 싶은 시각
            <input
              type="number"
              min={0}
              max={23}
              value={notifyHour}
              onChange={(e) => setNotifyHour(Number(e.target.value))}
            />
          </label>
          <div className="onboarding-options">
            <button
              type="button"
              className={coachingTone === 'friendly' ? 'option-selected' : 'option'}
              onClick={() => setCoachingTone('friendly')}
            >
              친근한 스타일
            </button>
            <button
              type="button"
              className={coachingTone === 'formal' ? 'option-selected' : 'option'}
              onClick={() => setCoachingTone('formal')}
            >
              사무적인 스타일
            </button>
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <span className="onboarding-progress">{step + 1} / 4</span>
        <button type="button" disabled={!canProceed()} onClick={handleNext}>
          {step < 3 ? '다음' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
