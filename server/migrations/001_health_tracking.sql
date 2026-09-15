-- MyDoctor 건강 추적 기능 마이그레이션
-- Impakt 구조 참고: 온보딩 -> 코치 -> 개인화 -> 추적 흐름을 지원하는 테이블

CREATE TABLE IF NOT EXISTS health_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('bp', 'glucose', 'weight', 'medication')),
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chronic_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('hypertension', 'diabetes', 'hyperlipidemia', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  condition_note TEXT,
  medication_taken BOOLEAN,
  symptom_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (
    metric_type IN ('bp_systolic', 'bp_diastolic', 'glucose_fasting', 'glucose_post_meal', 'weight')
  ),
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'device'))
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_user_type_time
  ON health_metrics (user_id, metric_type, recorded_at DESC);

CREATE TABLE IF NOT EXISTS coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('daily_checkin', 'trend_alert', 'encouragement')),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trend_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  window_days INTEGER NOT NULL DEFAULT 3,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  checkin_reminder_time TIME NOT NULL DEFAULT '09:00',
  trend_alert_enabled BOOLEAN NOT NULL DEFAULT true
);

-- users 테이블에 온보딩에서 받은 코칭 톤 컬럼 추가 (이미 있으면 무시)
ALTER TABLE users ADD COLUMN IF NOT EXISTS coaching_tone TEXT DEFAULT 'friendly'
  CHECK (coaching_tone IN ('friendly', 'formal'));
