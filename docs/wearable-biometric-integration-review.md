# 웨어러블/외부 생체측정기기 연동 검토 (2026-09)

## 0. 배경과 질문

Muse 뇌파 헤드밴드 연동(손·발 분석 결과에 "동시 측정 뇌파 컨텍스트"를 붙이는 기능, 2026-09)을 마친 뒤, "Muse 같은 뇌파 측정기기뿐 아니라 스마트워치 같은 외부 연결기기를 검색해서 MyDoctor 앱에 다양한 생체데이터 분석 기능을 추가하는 것"을 검토해 달라는 요청에 대한 조사 결과다. 아직 구현 여부를 결정한 것은 아니고, "무엇이 실제로 만들 수 있는 것이고 무엇이 아닌지"를 먼저 가리는 것이 목적이다 — `physical-ai-integration-review.md`와 같은 성격의 조사 전용 문서다.

**결론부터**: 스마트워치(애플워치·갤럭시워치·핏빗·가민·우라·웁 등)는 대부분 이 앱 구조로는 직접 연동이 안 되거나, 되더라도 지금 아키텍처(백엔드 없는 브라우저 전용 앱, SQLite, 셸 스크립트 배포)와 맞지 않는 수준의 복잡도가 필요하다. 실제로 지금 구조 그대로(Muse와 완전히 같은 방식) 바로 만들 수 있는 것은 **표준 BLE 심박 센서(가슴띠형, 예: Polar H10)** 정도다.

## 1. 두 갈래 길: 표준 BLE GATT vs 클라우드 OAuth API

### 1-1. 표준 BLE GATT — Muse와 완전히 같은 방식(백엔드/OAuth 불필요)

Muse 연동은 `muse-js`가 Muse 전용 BLE 프로토콜을 브라우저의 Web Bluetooth API(`navigator.bluetooth`)로 직접 읽는 구조였다. 블루투스 SIG가 표준화해둔 생체측정 GATT 서비스도 같은 방식으로 브라우저에서 바로 읽을 수 있다 — 심박(Heart Rate Service, 0x180D), 맥박산소(Pulse Oximeter), 혈압(Blood Pressure), 체온(Health Thermometer) 등.

**문제는 "표준이 있다"와 "실제 기기가 그 표준을 아무 앱에나 열어주는가"가 다르다는 점이다.**
- **된다**: Polar H10/Verity Sense, Wahoo Tickr 같은 **가슴띠·전용 심박 센서**는 실제로 이 표준 심박 서비스를 암호화 없이 브로드캐스트하고, Web Bluetooth로 직접 읽는 개발 사례가 실제로 존재한다.
- **부분적으로 된다**: 가민(Garmin) 워치 일부는 "심박수 브로드캐스트" 설정을 켜면 표준 서비스를 내보낸다 — 다만 기본값이 아니라 사용자가 매번 켜야 하는 옵션이다.
- **안 된다**: 애플워치·갤럭시워치·핏빗·우라·웁은 실시간 센서 값을 표준 GATT로 공개하지 않는다 — 자사 앱/클라우드로만 데이터가 흐르도록 잠겨 있다.

### 1-2. 클라우드 OAuth API — Muse와 완전히 다른 아키텍처가 필요

핏빗·가민 커넥트·우라·웁·구글 헬스커넥트는 OAuth 앱 등록, 토큰 저장/갱신을 처리할 백엔드, 그리고 대개 "실시간 스트리밍"이 아니라 "이미 클라우드에 동기화된 과거 데이터를 나중에 가져오는" 방식이다. MyDoctor의 "분석 직전/직후 스냅샷 캡처"라는 사용 흐름과 맞지 않는다. 구체적으로:
- **핏빗 Web API**: 2026년 현재 구글 Health API 쪽으로 재편/단계적 종료가 진행 중이라, 지금 새로 붙이기엔 기반이 흔들리는 시점이다.
- **애플 HealthKit**: **iOS 네이티브 전용 API라 웹앱에서는 아예 접근 불가능** — 네이티브 iOS 앱을 별도로 만들어야 하는데, 이건 "모바일 앱 없이 브라우저만으로" 가는 지금 방향과 정면으로 배치된다.
- **가민 커넥트 개발자 프로그램**: 사업자 승인 절차와 비용이 걸려 있어 개인 규모 앱이 바로 쓰기 어렵다.
- **우라/웁**: 상대적으로 접근성은 낫지만 여전히 서버 쪽 토큰 관리가 필요하다.

### 1-3. 플랫폼 제약 (Muse 때와 동일)

Web Bluetooth는 Chrome/Edge(윈도우·맥·리눅스·크롬OS·안드로이드)에서만 되고, **iOS의 모든 브라우저(사파리는 물론 iOS용 크롬도 포함)와 데스크톱 사파리, 카카오톡 등 인앱 브라우저에서는 아예 안 된다** — Muse 기능에 이미 있는 `isWebBluetoothSupported()` 안내 문구와 같은 제약이 그대로 적용된다.

## 2. 심박수/HRV를 "전·후 비교 지표"로 쓰는 것의 과학적 근거

Muse의 전두엽 알파 비대칭처럼, 심박 데이터도 "이 스트레칭/재활 세션 전후로 몸이 얼마나 이완됐는가"를 보여주는 참고 지표로 쓸 근거가 있는지 확인했다.

- **근거 있음**: 운동 직후 심박수 회복(Heart Rate Recovery, HRR)과 단기 HRV 변화는 부교감신경 재활성화를 반영하는, 임상에서도 실제로 쓰이는 지표다.
- **단서**: 이건 가슴띠(ECG 기반)일 때 신뢰도가 높다는 전제에서다. 손목형 PPG(광혈류측정) 센서는 움직임에 매우 취약한데, 하필 "스트레칭 직후"가 이 문제가 가장 심할 수 있는 순간이다. 맥박산소(SpO2) 센서는 피부톤에 따른 정확도 편차가 학계에 문서화돼 있다 — Muse 때 "이 신호가 실제로 뭘 뜻하는지 과장하지 않는다"는 원칙을 세운 것과 같은 이유로, SpO2는 추가하더라도 신중하게 다뤄야 한다.

## 3. 권장 방향

**1순위(바로 시도 가능)**: **표준 BLE 심박 서비스 지원 가슴띠/전용 심박 센서**(Polar H10/Verity Sense 계열) — 지금 아키텍처를 하나도 안 바꾸고 Muse와 완전히 같은 패턴(`shared/lib/`에 연결 코드 추가 → `EegCaptureControl`과 같은 형태의 캡처 UI → 손/발 세션에 선택적 컨텍스트 필드로 저장)으로 붙일 수 있다. 임상 근거도 지금 쓰고 있는 EEG 비대칭 지표보다 오히려 더 탄탄하다(심박수 회복은 이미 확립된 지표).

**보류/비권장**:
- **애플 HealthKit** — 웹앱 구조 자체와 근본적으로 안 맞는다(네이티브 앱 필수). 지금 "모바일 앱 없이 브라우저 하나로 간다"는 프로젝트 전제를 뒤집지 않는 한 검토 대상이 아니다.
- **핏빗/가민 커넥트/우라/웁 등 OAuth 연동** — 기술적으로 불가능하진 않지만, 백엔드 토큰 관리·사업자 승인·비동기 동기화까지 새로 들여와야 해서 지금 "SQLite + 셸 스크립트 배포"라는 최소 인프라 철학과 충돌한다. 게다가 "분석 직전/직후 즉시 캡처"라는 지금 UX 자체가 안 맞는다(클라우드 동기화는 실시간이 아님).
- **맥박산소(SpO2) 센서** — 표준 GATT는 있지만 소비자용 기기 보급이 낮고, 피부톤 편향 이슈까지 있어 지금 단계에서 추가할 실익이 적다.

## 4. 다음 결정이 필요한 지점

이 문서는 조사 결과이고, 실제 구현 여부·범위는 아직 결정된 게 아니다. 진행한다면 다음을 먼저 정해야 한다:
- 손/발 분석에 Muse처럼 "선택적 부가 기능"으로 붙일지, 아니면 새로운 독립 분석 모듈(예: XMSK처럼 별도 탭)로 만들지.
- 트레이너가 실제로 이런 기기를 구비하고 쓸 유인이 있는지 — Muse도 그렇지만 이런 부가 기기는 도입 장벽(기기 구매 비용)이 있어, 실제 사용 가능성을 먼저 트레이너에게 확인해보는 것이 코드를 먼저 짜는 것보다 우선일 수 있다.

## 참고 자료

- Bluetooth SIG, [Pulse Oximeter Service 명세](https://www.bluetooth.com/specifications/specs/pulse-oximeter-service-1-0-1/), [Blood Pressure Service 명세](https://www.bluetooth.com/specifications/specs/bls-1-1-1/)
- Web Bluetooth + Polar H10 실시간 HRV 구현 사례: [dev.to](https://dev.to/wellallytech/hack-your-stress-real-time-hrv-analysis-with-web-bluetooth-and-polar-h10-4ica)
- Web Bluetooth + Polar Verity Sense 사례: [dev.to](https://dev.to/manufac/interacting-with-polar-verity-sense-using-web-bluetooth-553a)
- 핏빗 Web API 2026년 개편/종료 가이드: [openwearables.io](https://openwearables.io/blog/fitbit-web-api-shutdown-2026-migration-guide)
- 구글 Health Connect/Health API 설정: [developers.google.com](https://developers.google.com/health/setup)
- 애플 HealthKit이 네이티브 앱을 요구하는 이유: [themomentum.ai](https://www.themomentum.ai/blog/do-you-need-a-mobile-app-to-access-apple-health-data)
- 가민 개발자 프로그램 접근 제약: [aifitnessapi.com](https://aifitnessapi.com/fix/garmin-api-approval)
- Web Bluetooth 브라우저 지원 현황: [caniuse.com/web-bluetooth](https://caniuse.com/web-bluetooth)
- 운동 후 심박수 회복/HRV 관련 리뷰: [MDPI, Sensors](https://www.mdpi.com/1424-8220/26/1/3), [Frontiers in Physiology, 2026](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2026.1794752/full)
- PPG/SpO2 피부톤 편향 관련 연구: [IOPscience 리뷰](https://iopscience.iop.org/article/10.1088/1361-6579/acd51a), [Nature Scientific Reports, 2025](https://www.nature.com/articles/s41598-025-31116-9)
