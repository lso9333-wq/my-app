# MyDoctor

핸드폰으로 촬영한 영상을 업로드하면 브라우저에서 바로 분석해주는 웹 앱입니다. 두 가지 독립된 기능을 제공합니다.

1. **보행 분석** — 옆에서 촬영한 걷는 영상으로 케이던스, 걸음 간격, 보폭, 좌우 대칭성, 좌우 흔들림 등을 계산
2. **스트레칭 가동범위(ROM) 분석** — 한 영상에서 스트레칭 전/후 구간을 지정하면 관절별 각도 변화를 계산

영상과 프레임별 포즈 데이터는 서버로 전송되지 않고 모두 브라우저 안에서 처리됩니다. ROM 분석은 계산된 수치 결과만 저장을 위해 백엔드로 전송됩니다.

> ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.

## 화면 구성

앱을 열면 먼저 **홈 대시보드**가 나오고, 화면 하단 탭바(홈/보행/ROM/XMSK)로 기능을 오갈 수 있습니다. 홈 화면은 각 기능으로 바로 이동할 수 있는 카드와, 최근 저장된 ROM 분석 기록 미리보기를 보여줍니다.

## 동작 방식

### 보행 분석

1. **영상 업로드** — 옆에서 촬영한 걷는 영상을 드래그하거나 선택
2. **포즈 추출** — TensorFlow.js MoveNet(SinglePose Thunder) 모델로 프레임마다 관절 좌표를 추정 (`src/shared/lib/poseDetector.ts`)
3. **보행 지표 계산** — 발목 궤적의 극댓값(foot-strike)을 찾아 케이던스, 걸음 간격, 보폭, 좌우 대칭성, 좌우 흔들림 등을 산출 (`src/features/gait/lib/gaitAnalysis.ts`)
4. **결과 확인** — 스켈레톤 오버레이 영상 재생, 지표 패널, 걸음 간격/좌우 비교 차트로 결과 표시

모든 거리 지표는 카메라 거리·각도가 일정하지 않은 점을 감안해 미터가 아닌 **다리 길이 기준 상대 단위**로 계산됩니다.

### 스트레칭 가동범위(ROM) 분석

1. **영상 업로드 및 구간 지정** — 스트레칭 전/후 모습이 담긴 영상을 업로드한 뒤, 타임라인에서 "전"/"후" 구간을 각각 지정 (`RangeSelector`)
2. **포즈 추출 및 관절 각도 계산** — 각 구간에서 프레임별 포즈를 추출하고, 어깨·팔꿈치·엉덩이·무릎 등 8개 관절의 각도를 계산 (`src/features/rom/lib/jointAngles.ts`)
3. **가동범위 비교** — 구간별 관절 각도의 최소/최대값으로 가동범위(ROM)를 구하고, 전/후 변화량을 계산 (`src/features/rom/lib/romAnalysis.ts`)
4. **결과 확인 및 저장** — 관절별 전/후/변화량 표와 비교 차트로 결과 표시, 계산된 수치는 백엔드(SQLite)에 저장되어 기록 조회 가능

## 기술 스택

- Vite + React 19 + TypeScript (프론트엔드)
- [@tensorflow/tfjs](https://www.tensorflow.org/js) + [@tensorflow-models/pose-detection](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) (MoveNet)
- Express + Node 내장 SQLite(`node:sqlite`) (백엔드, ROM 세션 저장용)
- 린트: [Oxlint](https://oxc.rs)

## 시작하기

```bash
npm install
npm run dev             # Vite dev 서버 + API 서버 동시 실행 (HMR)
npm run dev:client      # Vite dev 서버만 실행
npm run dev:server      # API 서버만 실행 (watch 모드)
npm run build           # 프론트엔드 타입 체크(tsc -b) 후 프로덕션 빌드
npm run start           # 빌드된 dist/를 API 서버로 서빙 (프론트엔드 + API 단일 프로세스)
npm run typecheck:server  # server/ 타입 체크 (별도 tsconfig)
npm run lint             # Oxlint 실행
npm run preview          # 빌드 결과 로컬 미리보기
```

테스트 러너는 별도로 구성되어 있지 않습니다.

## 프로젝트 구조

기능별(feature-first) 구조입니다 — 홈 대시보드 + 하단 탭 내비게이션으로 보행 분석/ROM 분석/XMSK 세 기능을 오갑니다.

```
src/
├── app/App.tsx                # 헤더 + 탭 콘텐츠 + 하단 탭바로 구성된 셸
├── navigation/BottomNav.tsx   # 홈/보행/ROM/XMSK 하단 탭바
├── features/
│   ├── home/HomeScreen.tsx    # 대시보드 — 기능 카드 3개 + 최근 ROM 기록 미리보기
│   ├── gait/                  # 보행 분석 (GaitApp.tsx, components/, lib/, types.ts)
│   ├── rom/                   # ROM 분석 (RomApp.tsx, components/, lib/, types.ts)
│   └── xmsk/                  # XMSK 트레이너 도구 (XmskApp.tsx, components/, lib/, types.ts)
├── shared/
│   ├── lib/poseDetector.ts    # MoveNet 로드 및 프레임별 포즈 추출 (보행+ROM 공유)
│   ├── lib/mathUtils.ts       # 공유 수학 유틸 (mean/stddev/movingAverage)
│   ├── lib/chartUtils.ts      # 공유 차트 유틸 (niceMax)
│   ├── components/VideoUploader.tsx      # 영상 업로드 UI (보행+ROM 공유)
│   ├── components/ComparisonBarChart.tsx # 좌우/전후 비교 막대그래프 (보행+ROM+XMSK 공유)
│   └── types/pose.ts          # Side/Point/PoseFrame (보행+ROM 공유 포즈 타입)
└── shims/mediapipe-pose-shim.ts  # 미사용 BlazePose 런타임 의존성 스텁

server/
├── index.ts                   # Express 앱, /api/rom-sessions·/api/xmsk 마운트, dist/ 정적 서빙
├── db.ts                      # node:sqlite로 server/data/rom.db 오픈 및 테이블 생성
├── routes/romSessions.ts      # ROM 세션 생성/목록/조회 라우트
├── routes/xmsk.ts             # XMSK 인증/세션/평가 라우트
└── types.ts                   # 요청/응답 타입 (src/features/*/types.ts와 별도 유지)
```

자세한 아키텍처 설명은 [CLAUDE.md](./CLAUDE.md)를 참고하세요.
