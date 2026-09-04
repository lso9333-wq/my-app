# 보행 분석 (Gait Analysis)

핸드폰으로 옆에서 촬영한 걷는 영상을 업로드하면, 브라우저에서 바로 걸음걸이를 분석해주는 웹 앱입니다. 영상은 서버로 전송되지 않고 모두 브라우저 안에서 처리됩니다.

> ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 보행 평가를 대체할 수 없습니다.

## 동작 방식

1. **영상 업로드** — 옆에서 촬영한 걷는 영상을 드래그하거나 선택
2. **포즈 추출** — TensorFlow.js MoveNet(SinglePose Thunder) 모델로 프레임마다 관절 좌표를 추정 (`src/lib/poseDetector.ts`)
3. **보행 지표 계산** — 발목 궤적의 극댓값(foot-strike)을 찾아 케이던스, 걸음 간격, 보폭, 좌우 대칭성, 좌우 흔들림 등을 산출 (`src/lib/gaitAnalysis.ts`)
4. **결과 확인** — 스켈레톤 오버레이 영상 재생, 지표 패널, 걸음 간격/좌우 비교 차트로 결과 표시

모든 거리 지표는 카메라 거리·각도가 일정하지 않은 점을 감안해 미터가 아닌 **다리 길이 기준 상대 단위**로 계산됩니다.

## 기술 스택

- Vite + React 19 + TypeScript
- [@tensorflow/tfjs](https://www.tensorflow.org/js) + [@tensorflow-models/pose-detection](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) (MoveNet)
- 린트: [Oxlint](https://oxc.rs)

## 시작하기

```bash
npm install
npm run dev       # 개발 서버 실행 (HMR)
npm run build     # 타입 체크(tsc -b) 후 프로덕션 빌드
npm run lint       # Oxlint 실행
npm run preview   # 빌드 결과 로컬 미리보기
```

테스트 러너는 별도로 구성되어 있지 않습니다.

## 프로젝트 구조

```
src/
├── App.tsx                    # 업로드 → 분석 → 결과 표시 파이프라인 상태 관리
├── lib/
│   ├── poseDetector.ts        # MoveNet 로드 및 프레임별 포즈 추출
│   └── gaitAnalysis.ts        # 보행 지표 계산 (순수 함수)
├── components/
│   ├── VideoUploader.tsx      # 영상 업로드 UI
│   ├── SkeletonViewer.tsx     # 스켈레톤 오버레이 영상 재생/스크러버
│   ├── GaitMetricsPanel.tsx   # 지표 요약 패널
│   └── GaitCharts.tsx         # 걸음 간격/좌우 비교 차트
├── types/gait.ts              # 공유 타입 정의
└── shims/mediapipe-pose-shim.ts  # 미사용 BlazePose 런타임 의존성 스텁
```

자세한 아키텍처 설명은 [CLAUDE.md](./CLAUDE.md)를 참고하세요.
