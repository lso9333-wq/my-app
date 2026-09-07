# MyDoctor

핸드폰으로 촬영한 영상을 업로드하면 브라우저에서 바로 분석해주는 웹 앱입니다. 두 가지 독립된 기능을 제공합니다.

1. **보행 분석** — 옆에서 촬영한 걷는 영상으로 케이던스, 걸음 간격, 보폭, 좌우 대칭성, 좌우 흔들림 등을 계산
2. **스트레칭 가동범위(ROM) 분석** — 한 영상에서 스트레칭 전/후 구간을 지정하면 관절별 각도 변화를 계산

영상과 프레임별 포즈 데이터는 서버로 전송되지 않고 모두 브라우저 안에서 처리됩니다. ROM 분석은 계산된 수치 결과만 저장을 위해 백엔드로 전송됩니다.

> ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.

## 동작 방식

### 보행 분석

1. **영상 업로드** — 옆에서 촬영한 걷는 영상을 드래그하거나 선택
2. **포즈 추출** — TensorFlow.js MoveNet(SinglePose Thunder) 모델로 프레임마다 관절 좌표를 추정 (`src/lib/poseDetector.ts`)
3. **보행 지표 계산** — 발목 궤적의 극댓값(foot-strike)을 찾아 케이던스, 걸음 간격, 보폭, 좌우 대칭성, 좌우 흔들림 등을 산출 (`src/lib/gaitAnalysis.ts`)
4. **결과 확인** — 스켈레톤 오버레이 영상 재생, 지표 패널, 걸음 간격/좌우 비교 차트로 결과 표시

모든 거리 지표는 카메라 거리·각도가 일정하지 않은 점을 감안해 미터가 아닌 **다리 길이 기준 상대 단위**로 계산됩니다.

### 스트레칭 가동범위(ROM) 분석

1. **영상 업로드 및 구간 지정** — 스트레칭 전/후 모습이 담긴 영상을 업로드한 뒤, 타임라인에서 "전"/"후" 구간을 각각 지정 (`RangeSelector`)
2. **포즈 추출 및 관절 각도 계산** — 각 구간에서 프레임별 포즈를 추출하고, 어깨·팔꿈치·엉덩이·무릎 등 8개 관절의 각도를 계산 (`src/lib/jointAngles.ts`)
3. **가동범위 비교** — 구간별 관절 각도의 최소/최대값으로 가동범위(ROM)를 구하고, 전/후 변화량을 계산 (`src/lib/romAnalysis.ts`)
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

```
src/
├── App.tsx                    # 헤더 + 보행 분석/ROM 분석 탭 전환
├── GaitApp.tsx                # 보행 분석 파이프라인 상태 관리
├── RomApp.tsx                 # ROM 분석 파이프라인 상태 관리
├── lib/
│   ├── poseDetector.ts        # MoveNet 로드 및 프레임별 포즈 추출 (공유)
│   ├── mathUtils.ts           # 공유 수학 유틸 (mean/stddev/movingAverage)
│   ├── gaitAnalysis.ts        # 보행 지표 계산 (순수 함수)
│   ├── jointAngles.ts         # 프레임별 관절 각도 계산
│   ├── romAnalysis.ts         # ROM 전/후 비교 계산 (순수 함수)
│   └── romApi.ts              # ROM 세션 백엔드 API 래퍼
├── components/
│   ├── VideoUploader.tsx      # 영상 업로드 UI (공유)
│   ├── SkeletonViewer.tsx     # 스켈레톤 오버레이 영상 재생/스크러버
│   ├── GaitMetricsPanel.tsx   # 보행 지표 요약 패널
│   ├── GaitCharts.tsx         # 걸음 간격/좌우 비교 차트 (공유 컴포넌트 포함)
│   ├── RangeSelector.tsx      # 전/후 구간 지정 타임라인
│   ├── RomResultsPanel.tsx    # 관절별 전/후/변화량 결과 패널
│   └── RomSessionHistory.tsx  # 저장된 ROM 세션 기록 목록
├── types/
│   ├── gait.ts                # 보행 분석 타입 정의
│   └── rom.ts                 # ROM 분석 타입 정의
└── shims/mediapipe-pose-shim.ts  # 미사용 BlazePose 런타임 의존성 스텁

server/
├── index.ts                   # Express 앱, /api/rom-sessions 마운트, dist/ 정적 서빙
├── db.ts                      # node:sqlite로 server/data/rom.db 오픈 및 테이블 생성
├── routes/romSessions.ts      # ROM 세션 생성/목록/조회 라우트
└── types.ts                   # 요청/응답 타입 (src/types/rom.ts와 별도 유지)
```

자세한 아키텍처 설명은 [CLAUDE.md](./CLAUDE.md)를 참고하세요.
