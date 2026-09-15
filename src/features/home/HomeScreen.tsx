import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// 실제 API 클라이언트, 타입 위치에 맞춰 import 경로 조정 필요.
// server/routes에 /api/home-summary 같은 엔드포인트가 있다고 가정한 draft.

// App.tsx가 실제로 쓰는 AppTab / InfoKey 타입을 아직 확인하지 못해 any로 받는다.
// App.tsx에서 이 타입들을 export하고 있다면 아래 두 줄을 지우고
// import { AppTab, InfoKey } from '../../app/App'; 같은 형태로 바꿔 좁혀주는 게 좋다.
interface HomeScreenProps {
  onNavigate: (next: any) => void;
  onOpenInfo: Dispatch<SetStateAction<any>>;
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

export function HomeScreen({ onNavigate, onOpenInfo }: HomeScreenProps) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHomeSummary()
      .then(setSummary)
      .catch(() => setError('데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'));
  }, []);

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
        <button
          type="button"
          className="home-notify-button"
          aria-label="알림"
          onClick={() => onOpenInfo('notifications')}
        >
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

      <button type="button" className="checkin-button" onClick={() => onNavigate('checkin')}>
        오늘의 체크인 시작하기
      </button>
    </div>
  );
}

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
