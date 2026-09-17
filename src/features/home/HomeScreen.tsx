import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppTab } from '../../navigation/BottomNav';
import type { InfoKey } from '../../app/legalContent';
import { saveHealthMetric, saveCoachMessage, fetchRecentActivity, type RecentActivityItem } from './lib/homeApi';
import { AuthError } from '../../shared/lib/authApi';

interface HomeScreenProps {
  onNavigate: (next: AppTab) => void;
  onOpenInfo: Dispatch<SetStateAction<InfoKey | null>>;
  /** 2026-09 추가 — 로그인 상태일 때만 건강 수치 직접 입력 + 최근 기록(회원 이름
   * 포함) 목록을 보여주기 위해 App.tsx에서 전달받는다. home은 원래 비로그인
   * 탭이라 로그인 전엔 undefined다. */
  token?: string;
}

interface HomeSummary {
  userName: string;
  priorityMetric: {
    label: string;
    value: string;
    unit: string;
    trendPoints: number[];
    coachComment: string;
  };
  secondaryMetrics: { label: string; value: string; unit: string }[];
  coachName: string;
  coachMessage: string;
}

async function fetchHomeSummary(): Promise<HomeSummary> {
  const res = await fetch('/api/home-summary');
  if (!res.ok) {
    throw new Error('홈 요약 정보를 가져오지 못했습니다');
  }
  return res.json();
}

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  rom: 'ROM',
  xcts: 'XCTS',
  gait: '보행',
  hand: '손',
  foot: '발',
  eeg: '뇌파',
};

export function HomeScreen({ onNavigate, onOpenInfo: _onOpenInfo, token }: HomeScreenProps) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');
  const [weight, setWeight] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [activity, setActivity] = useState<RecentActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [coachInput, setCoachInput] = useState('');
  const [coachSaveState, setCoachSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [coachSaveError, setCoachSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchHomeSummary()
      .then(setSummary)
      .catch(() => setError('데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'));
  }, []);

  useEffect(() => {
    if (!token) {
      setActivity(null);
      return;
    }
    fetchRecentActivity(token)
      .then(setActivity)
      .catch((err) => {
        if (err instanceof AuthError) return; // 토큰 만료 시 조용히 무시(App.tsx가 곧 잠금 화면으로 되돌림)
        setActivityError('최근 기록을 불러오지 못했어요.');
      });
  }, [token]);

  const refreshSummary = () => {
    fetchHomeSummary()
      .then(setSummary)
      .catch(() => {
        /* 요약 새로고침 실패는 조용히 무시 — 기존 값을 그대로 보여준다 */
      });
  };

  const handleSaveMetrics = async () => {
    if (!token) return;
    setSaveState('saving');
    try {
      const entries: [HealthMetricEntryType, string][] = [
        ['bp_systolic', systolic],
        ['bp_diastolic', diastolic],
        ['glucose_fasting', glucose],
        ['weight', weight],
      ];
      for (const [metricType, raw] of entries) {
        if (raw.trim() === '') continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;
        await saveHealthMetric(token, metricType, value);
      }
      setSaveState('saved');
      setSystolic('');
      setDiastolic('');
      setGlucose('');
      setWeight('');
      refreshSummary();
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : '저장에 실패했어요.');
    }
  };

  const handleSaveCoachMessage = async () => {
    if (!token || coachInput.trim() === '') return;
    setCoachSaveState('saving');
    try {
      await saveCoachMessage(token, coachInput.trim());
      setCoachSaveState('saved');
      setCoachInput('');
      refreshSummary();
    } catch (err) {
      setCoachSaveState('error');
      setCoachSaveError(err instanceof Error ? err.message : '저장에 실패했어요.');
    }
  };

  if (error) {
    return <div className="home-error">{error}</div>;
  }

  if (!summary) {
    return <div className="home-loading">불러오는 중...</div>;
  }

  return (
    <div className="home-screen">
      <header className="home-header">
        <div>
          <p className="home-greeting">좋은 아침이에요</p>
          <p className="home-username">{summary.userName}님</p>
        </div>
        <button type="button" className="home-notify-button" aria-label="알림" disabled>
          🔔
        </button>
      </header>

      <section className="priority-card">
        <p className="priority-label">오늘의 우선 지표: {summary.priorityMetric.label}</p>
        <div className="priority-value">
          <span>{summary.priorityMetric.value}</span>
          <span className="priority-unit">{summary.priorityMetric.unit}</span>
        </div>
        <TrendSparkline points={summary.priorityMetric.trendPoints} />
        <p className="priority-comment">{summary.priorityMetric.coachComment}</p>
      </section>

      <section className="secondary-metrics">
        {summary.secondaryMetrics.map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className="metric-value">
              {m.value} <span className="metric-unit">{m.unit}</span>
            </p>
          </div>
        ))}
      </section>

      <section className="coach-message">
        <p className="coach-name">{summary.coachName}</p>
        <p className="coach-text">{summary.coachMessage}</p>
      </section>

      {token && (
        <section className="metric-card">
          <p className="priority-label">코치 멘트 수정</p>
          <label>
            새 멘트 (200자 이내)
            <input
              type="text"
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder="예: 오늘도 꾸준히 관리해봐요!"
              maxLength={200}
            />
          </label>
          <button
            type="button"
            onClick={handleSaveCoachMessage}
            disabled={coachSaveState === 'saving' || coachInput.trim() === ''}
          >
            {coachSaveState === 'saving' ? '저장 중...' : '멘트 저장'}
          </button>
          {coachSaveState === 'saved' && <p className="priority-comment">저장했어요.</p>}
          {coachSaveState === 'error' && <p className="priority-comment">저장 실패: {coachSaveError}</p>}
        </section>
      )}

      {token && (
        <section className="metric-card">
          <p className="priority-label">오늘의 수치 입력</p>
          <div className="secondary-metrics">
            <label>
              수축기 혈압
              <input
                type="number"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder="mmHg"
              />
            </label>
            <label>
              이완기 혈압
              <input
                type="number"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder="mmHg"
              />
            </label>
            <label>
              공복혈당
              <input type="number" value={glucose} onChange={(e) => setGlucose(e.target.value)} placeholder="mg/dL" />
            </label>
            <label>
              체중
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" />
            </label>
          </div>
          <button type="button" onClick={handleSaveMetrics} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? '저장 중...' : '수치 저장'}
          </button>
          {saveState === 'saved' && <p className="priority-comment">저장했어요.</p>}
          {saveState === 'error' && <p className="priority-comment">저장 실패: {saveError}</p>}
        </section>
      )}

      {token ? (
        <section className="home-recent">
          <div className="home-recent-head">
            <h3>최근 기록</h3>
          </div>
          {activityError && <p className="home-recent-empty">{activityError}</p>}
          {!activityError && activity && activity.length === 0 && (
            <p className="home-recent-empty">최근 기록이 없어요.</p>
          )}
          {!activityError && activity && activity.length > 0 && (
            <ul className="home-recent-list">
              {activity.map((item, i) => (
                <li key={`${item.type}-${item.createdAt}-${i}`} className="home-recent-row">
                  <span className="home-recent-date">
                    {new Date(item.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="home-recent-name">
                    {ACTIVITY_TYPE_LABEL[item.type] ?? item.type}
                    {item.clientName ? ` · ${item.clientName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="app-subtitle">
          로그인하면 직접 수치를 입력하고, 보행·ROM·손발·XCTS·뇌파의 최근 기록도 여기서 볼 수 있어요.
        </p>
      )}

      {/* 코드베이스 관례상 HomeScreen의 기본 CTA는 rom 탭으로 연결한다
          (EegApp.tsx 등 여러 곳 주석에 언급된 "예외는 HomeScreen→rom 하나" 참고). */}
      <button type="button" className="checkin-button" onClick={() => onNavigate('rom')}>
        오늘의 체크인 시작하기
      </button>
    </div>
  );
}

type HealthMetricEntryType = 'bp_systolic' | 'bp_diastolic' | 'glucose_fasting' | 'weight';

function TrendSparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const width = 300;
  const height = 60;
  const step = width / (points.length - 1 || 1);

  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${x},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="trend-sparkline" role="img" aria-label="최근 추세 그래프">
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  );
}
