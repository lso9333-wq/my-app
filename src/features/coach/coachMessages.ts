// 코치 메시지 생성 로직 draft.
// server 쪽에서 trend_alerts, daily_checkins 데이터를 바탕으로 호출한다고 가정.

export type TriggerType = 'daily_checkin' | 'trend_alert' | 'encouragement';
export type CoachingTone = 'friendly' | 'formal';

interface TrendAlertInput {
  metricLabel: string;
  direction: 'up' | 'down';
  windowDays: number;
}

const TREND_TEMPLATES: Record<CoachingTone, (i: TrendAlertInput) => string> = {
  friendly: (i) =>
    `최근 ${i.windowDays}일간 ${i.metricLabel}이(가) ${i.direction === 'up' ? '오르는' : '내려가는'} 추세예요. 함께 확인해봐요.`,
  formal: (i) =>
    `최근 ${i.windowDays}일간 ${i.metricLabel} 수치가 ${i.direction === 'up' ? '상승' : '하락'} 추세로 확인되었습니다. 확인이 필요합니다.`,
};

const ENCOURAGEMENT_TEMPLATES: Record<CoachingTone, string[]> = {
  friendly: ['오늘도 체크인 완료했어요, 정말 잘하고 있어요!', '꾸준히 기록하는 모습이 멋져요.'],
  formal: ['오늘 체크인이 완료되었습니다.', '꾸준한 기록 관리가 확인되었습니다.'],
};

export function buildTrendAlertMessage(input: TrendAlertInput, tone: CoachingTone): string {
  return TREND_TEMPLATES[tone](input);
}

export function buildEncouragementMessage(tone: CoachingTone): string {
  const options = ENCOURAGEMENT_TEMPLATES[tone];
  return options[Math.floor(Math.random() * options.length)];
}
