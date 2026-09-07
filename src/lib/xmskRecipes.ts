import type { XmskRecipe, XmskRegionKey } from '../types/xmsk'

const INTENSITY_NOTE =
  '강도 조절 (전 레시피 공통): 처치 前 신호 → 강도 낮게·순환 위주 고지 / 처치 後 통증 → 강도 비율 불균형, 원인 찾아 분산 / 방사통·저림 → 즉시 위치 이동·강압 금지'

export const XMSK_INTENSITY_NOTE = INTENSITY_NOTE

export const XMSK_RECIPES: XmskRecipe[] = [
  {
    key: 'neckShoulder',
    title: '목·어깨 통증',
    subtitle: '후두하 및 뒷목 통증. 뒤가 당기면 앞을 깨운다.',
    translate: [
      { symptom: '거북목/일자목', meaning: '후두하·판상근 단축 + 굴곡근 약화' },
      { symptom: '승모근 뭉침/어깨 결림', meaning: '상부승모·견갑거 긴장' },
      { symptom: '목 안 돌아감/뻣뻣', meaning: '상부경추 가동 제한' },
      { symptom: '편두통/뒷골 당김', meaning: '후두하 긴장 → 후두신경 자극' },
    ],
    emergencyFlags: [
      '팔·손 힘 빠짐·양팔 저림',
      '목 젖히거나 돌릴 때 어지럼·시야 흐림 (추골동맥)',
      '외상 직후',
      '야간통 + 발열',
    ],
    beforeChecklist: ['목 회전·측굴, 팔 올리기(굴곡·외전) 가동 확인', '후두하·상부승모 압통 촉지'],
    measurements: [
      { id: 'neckRotation', label: '목 회전', unit: '도', sides: 'lr' },
      { id: 'neckSideBend', label: '목 측굴', unit: '도', sides: 'lr' },
      { id: 'armRaise', label: '팔 올리기 (굴곡·외전)', unit: '도', sides: 'lr' },
    ],
    steps: [
      { step: 'A', title: '후두하 직접 당기는 근육 이완', detail: '후두하근(강압 금지·추골동맥)·두판상근·상부승모근(쥐어짜기)' },
      { step: 'B', title: '약해진 굴곡근 가볍게 순환·활성', detail: 'SCM·사각근 — 강한 신장 아님, 가볍게 늘려 깨움' },
      { step: 'C [필수]', title: '보상 근육 이완', detail: '중·하부승모·견갑거·회전근개·기립근·능형근·소흉근' },
      { step: 'D', title: '길항근 활성 (마무리)', detail: '대흉근 스트레칭 — 후방 근육의 길항근' },
    ],
    adjustRules: [
      '후두하만 아픔 → A 우선·집중',
      '어깨·날개뼈까지 뭉침 → 촉지 후 경직 크면 C 비중↑',
      '좌우 차이 큼 → 경직 큰 쪽·가동 부족한 쪽부터',
    ],
    closingScript:
      '뒷목이 당기는 건 뒤통수 밑 근육이 머리를 잡아당겨서예요. 그걸 풀고 약해진 앞쪽을 깨우고, 대신 일하던 어깨·등까지 정리했어요. 앞뒤 균형을 맞춰야 오래갑니다.',
    selfCare: ['턱 당기기 5초×10회 (약해진 굴곡근 활성)', '문틀 가슴 열기 30초×2', '뒷목 늘리기 30초 좌우 (강하게 당기지 않기)'],
  },
  {
    key: 'lowBack',
    title: '허리 통증',
    subtitle: '요추는 지키고, 위(흉추)·아래(고관절)를 연다.',
    translate: [
      { symptom: '허리 뻐근/묵직', meaning: '요추 주변 과긴장 + 흉추·고관절 가동 부족' },
      { symptom: '오래 앉으면 아픔', meaning: '장요근 단축 + 둔근 약화' },
      { symptom: '앞으로 숙이면 아픔', meaning: '햄스트링 단축 → 골반 후방경사' },
      { symptom: '뒤로 젖히면 아픔', meaning: '장요근 단축 → 골반 전방경사' },
      { symptom: '엉덩이~다리 저림', meaning: '이상근·둔부 (Red Flag 먼저)' },
    ],
    emergencyFlags: [
      '다리 힘 빠짐·발끝 안 들림',
      '안장 부위 감각 저하·대소변 장애 (마미증후군·응급)',
      '양다리 저림·강한 방사통',
      '외상 직후',
      '야간통 + 발열',
    ],
    beforeChecklist: ['앞으로 숙이기, 골반-흉추 분리 움직임 확인', 'QL·기립근 압통 촉지'],
    measurements: [
      { id: 'forwardBend', label: '앞으로 숙이기 (손끝-바닥 거리)', unit: 'cm', sides: 'single' },
      { id: 'pelvisThoracicSeparation', label: '골반-흉추 분리', unit: '정도(0~10)', sides: 'single' },
    ],
    steps: [
      { step: 'A', title: '요추 주변 이완', detail: '요방형근(QL)·기립근(요추부)·광배근 — 요추 직접 강신장 금지' },
      {
        step: 'B/C',
        title: '가동 회복 — 평가로 순서 결정',
        detail: '하체 부족→고관절 먼저(장요근·햄스트링·둔근·이상근) / 상체 부족→흉추 먼저(흉추 신전·회전·광배근)',
      },
      { step: 'D', title: '안정근 가볍게 활성', detail: '둔근·코어 가볍게 깨움' },
    ],
    adjustRules: [
      '상·하체 가동 비교 → 더 부족한 쪽부터',
      '앞으로 숙일 때 아픔 → 햄스트링↑ / 뒤로 젖힐 때 → 장요근↑',
      '오래 앉으면 아픔 → 장요근 이완 + 둔근 활성↑',
    ],
    closingScript:
      '허리는 원래 버티는 자리예요. 위(등)와 아래(고관절)가 굳으면 허리가 대신 일하다 아파요. 오늘은 허리를 직접 건드리기보다 등·고관절을 풀고 엉덩이·배 속을 가볍게 깨웠어요. 허리는 지킬 곳이에요.',
    selfCare: ['런지 장요근 스트레칭 30초 좌우', '브릿지 10회×2 (둔근 가볍게)', '폼롤러 흉추 열기 / ※ 허리 직접 비틀기 금지'],
  },
  {
    key: 'knee',
    title: '무릎 통증',
    subtitle: '무릎은 위(고관절)·아래(발목)에 낀 관절. 기계적 햄스트링 탈피.',
    translate: [
      { symptom: '무릎 시큰/아픔', meaning: '대부분 무릎 아님 → 고관절·발목 정렬' },
      { symptom: '계단 내려갈 때', meaning: '대퇴사두·슬개골 정렬, 둔근 약화' },
      { symptom: '무릎 안쪽 아픔', meaning: '거위발건·내전근' },
      { symptom: '쪼그리면 아픔', meaning: '발목 배측굴곡 제한 → 무릎 보상' },
      { symptom: 'O/X 다리 느낌', meaning: '골반 경사·고관절 회전' },
    ],
    emergencyFlags: ['무릎 잠김 (폈다 굽혔다 안 됨)', '급성 부종·발열', '외상 직후 불안정 (휘청)', '체중 못 실음'],
    beforeChecklist: ['쪼그려 앉기, 무릎 굴곡 가동 확인', '족관절·고관절 가동 비교 (덜 나오는 곳 파악)'],
    measurements: [
      { id: 'squat', label: '쪼그려 앉기', unit: '정도(0~10)', sides: 'single' },
      { id: 'kneeFlexion', label: '무릎 굴곡', unit: '도', sides: 'lr' },
    ],
    steps: [
      { step: 'A', title: '무릎 주변 이완 (두 관절 근육)', detail: '대퇴사두(직근)·햄스트링·비복근·거위발건 — 햄스트링만 늘리지 않기' },
      {
        step: 'B/C',
        title: '위·아래 — 덜 나오는 곳부터',
        detail: '고관절 부족→장요근·둔근·이상근·TFL / 발목 부족→비복·가자미·전경골근·발목 가동',
      },
      { step: 'D', title: '정렬 안정근 가볍게 활성', detail: '둔근(외반 방지)·내측광근(VMO) 가볍게' },
    ],
    adjustRules: [
      '족관절 vs 고관절 가동 비교 → 덜 나오는 곳부터 (핵심)',
      '무릎 안쪽 아픔 → 거위발건·내전근↑',
      '쪼그릴 때 아픔 → 발목 배측굴곡↑',
    ],
    closingScript:
      '무릎은 위아래에 낀 관절이라, 무릎만 봐선 안 돼요. 고관절이 틀어지거나 발목이 굳으면 낀 무릎이 스트레스를 받아요. 오늘은 무릎 주변과 골반·발목까지 풀고, 무릎을 잡아주는 근육을 가볍게 깨웠어요.',
    selfCare: ['벽 밀기 배측굴곡 30초 좌우', '둔근 브릿지·클램 10회×2', '폼롤러 허벅지 앞·옆 / ※ 아픈 무릎 무리한 반복 금지'],
  },
  {
    key: 'ankle',
    title: '발목 통증',
    subtitle: '체중부하의 주춧돌. 족저·아킬레스 포함. 수직 체인의 시작점.',
    translate: [
      { symptom: '발목 시큰/자주 삠', meaning: '발목 안정성 저하·정렬' },
      { symptom: '아침 첫발 아픔', meaning: '족저근막 (밤새 단축)' },
      { symptom: '뒤꿈치 뒤 아픔', meaning: '아킬레스·비복·가자미근' },
      { symptom: '쪼그리면 앞 막힘', meaning: '배측굴곡 제한 (거골 활주)' },
      { symptom: '아치 무너짐/평발', meaning: '후경골근 약화 → 위로 연쇄' },
    ],
    emergencyFlags: ['외상 후 체중 못 실음·심한 부종 (골절)', '아킬레스 파열음 + 발끝 못 섬', '발등·발가락 감각 소실·창백'],
    beforeChecklist: ['배측굴곡(벽 밀기 거리) 확인', '아킬레스 꼬집어 비틀기·뒤꿈치 압박으로 통증 확인'],
    measurements: [{ id: 'dorsiflexion', label: '배측굴곡 (벽 밀기 거리)', unit: 'cm', sides: 'lr' }],
    steps: [
      { step: 'A', title: '발목·발 직접 이완', detail: '비복근·가자미근·아킬레스 주변·족저근막·전경골근' },
      { step: 'B', title: '발목 가동 회복 (배측굴곡 중심)', detail: '발목 배측굴곡·거골 활주·후경골근(아치)' },
      { step: 'C', title: '위 연쇄 점검 (발목 가동 회복 후)', detail: '무릎 정렬(사두·장경인대)·고관절(둔근)' },
      { step: 'D', title: '안정근 가볍게 활성', detail: '비골근·후경골근·발 내재근 가볍게 — 해결 아닌 가동 개선 보조' },
    ],
    adjustRules: [
      '아침 첫발 통증 → 족저근막·비복근↑',
      '뒤꿈치 뒤 → 아킬레스·가자미근(무릎 굽혀 구분)↑',
      '자주 삠(불안정) → D 비골근·후경골근↑',
    ],
    closingScript:
      '발목은 몸 전체를 떠받치는 주춧돌이에요. 여기가 굳으면 위의 무릎·골반·허리까지 틀어져요. 오늘은 종아리·발바닥을 풀어 발목이 잘 접히게 만들고, 발목 잡아주는 근육을 가볍게 깨웠어요.',
    selfCare: ['벽 밀기 배측굴곡 30초 좌우 (무릎 펴고/굽혀)', '발바닥 공 굴리기 1~2분', '뒤꿈치 들기 10회×2 (가볍게)'],
  },
  {
    key: 'hip',
    title: '고관절 통증',
    subtitle: '하체 움직임의 중심축. 가동성 관절이라 굳으면 위아래가 보상.',
    translate: [
      { symptom: '앞 접힐 때 아픔/막힘', meaning: '장요근 단축·대퇴골두 전방 활주' },
      { symptom: '엉덩이 깊은 곳 아픔', meaning: '이상근·심부 외회전근' },
      { symptom: '엉덩이~다리 저림', meaning: '이상근→좌골신경 (Red Flag 먼저)' },
      { symptom: '바깥이 아픔', meaning: 'TFL·장경인대·중둔근' },
      { symptom: '사타구니 아픔', meaning: '내전근·장요근' },
    ],
    emergencyFlags: [
      '외상 후 체중 못 실음·다리 짧아 보임·회전 이상 (골절·탈구)',
      '밤에 심한 통증 + 발열',
      '강한 방사통 + 힘 빠짐',
    ],
    beforeChecklist: [
      '고관절 굴곡·다리 벌리기 가동 확인',
      '발목 크로스 테스트 — 골반 안 따라오면 전방경사 / 몸통 따라오면 후방경사',
    ],
    measurements: [
      { id: 'hipFlexion', label: '고관절 굴곡', unit: '도', sides: 'lr' },
      { id: 'legAbduction', label: '다리 벌리기', unit: '도', sides: 'lr' },
    ],
    steps: [
      { step: 'A', title: '고관절 주변 이완 (사방향 골고루)', detail: '장요근(앞)·둔근·이상근(뒤)·내전근(안)·TFL(바깥)' },
      { step: 'B', title: '가동 회복 — 굴곡부터', detail: '굴곡 먼저 → 외회전(이상근)·신전(장요근)·외전(내전근)' },
      { step: 'C', title: '위·아래 연쇄 점검 (가동 회복 후)', detail: '요추 주변(QL·기립근)·무릎 정렬' },
      { step: 'D', title: '안정근 가볍게 활성', detail: '중둔근(골반 안정) 가볍게' },
    ],
    adjustRules: [
      '굴곡부터 → 이후 막힌 방향(외회전/신전/외전)',
      '발목 크로스 결과 → 전방경사면 장요근↑ / 후방경사면 둔근·햄스트링↑',
      '엉덩이 깊은 곳/저림 → 이상근 신중(좌골신경·RedFlag)',
    ],
    closingScript:
      '고관절은 하체 움직임의 중심이에요. 어깨처럼 여러 방향으로 움직여야 해서, 굳으면 위로는 허리가 아래로는 무릎이 대신 움직이다 탈이 나요. 오늘은 앞·뒤·안·밖 골고루 풀어 제 방향으로 움직이게 만들었어요.',
    selfCare: ['런지 장요근 스트레칭 30초 좌우', '90/90·양반다리 외회전 스트레칭', '브릿지·클램 10회×2 (중둔근 가볍게)'],
  },
  {
    key: 'elbow',
    title: '팔꿈치 통증',
    subtitle: '팔꿈치 원인은 대개 팔꿈치가 아니다. 견갑골까지 역추적.',
    translate: [
      { symptom: '바깥이 아픔', meaning: '외측상과염(테니스엘보)·손목 신전근' },
      { symptom: '안쪽이 아픔', meaning: '내측상과염(골프엘보)·손목 굴곡근' },
      { symptom: '물건 들거나 짤 때', meaning: '전완 신전·굴곡근 과사용' },
      { symptom: '팔 앞 당기고 팔꿈치까지', meaning: '이두 (두 관절 근육)' },
      { symptom: '손저림 동반', meaning: '신경 포착 — Red Flag 확인' },
    ],
    emergencyFlags: ['외상 후 변형·심한 부종·굽힘 불가', '손·손가락 힘 빠짐·지속 저림 (신경 포착)', '발열 동반 부종'],
    beforeChecklist: ['손목 신전·굴곡 저항, 팔 뻗기 확인', '외측/내측 상과 압통 확인'],
    measurements: [
      { id: 'wristResist', label: '손목 신전·굴곡 저항', unit: '정도(0~10)', sides: 'lr' },
      { id: 'armReach', label: '팔 뻗기', unit: '도', sides: 'lr' },
    ],
    steps: [
      { step: 'A', title: '전완 이완 (아픈 쪽 상과 근육부터)', detail: '외측 아픔→신전근 / 내측 아픔→굴곡근 · 공통: 이두·삼두' },
      { step: 'B', title: '위를 본다 — 어깨·견갑 역추적', detail: '견갑 정렬(소흉근·전거근)·회전근개·라운드숄더 여부' },
      { step: 'C', title: '손목까지 연쇄 점검', detail: '손목 굴곡·신전 가동·전완 회내/회외' },
      { step: 'D', title: '안정근 가볍게 활성', detail: '견갑 안정근(하부승모·전거근) 가볍게' },
    ],
    adjustRules: ['외측 vs 내측 → 아픈 상과 쪽 전완근↑', '라운드숄더 뚜렷 → B(견갑)↑', '저림 동반 → 신경 포착 의심, RedFlag 재확인'],
    closingScript:
      '팔꿈치가 아파도 원인은 팔꿈치가 아닌 경우가 많아요. 전완을 많이 써서 뼈 붙는 곳에 부하가 몰리는데, 그 위 어깨·날개뼈가 제자리에 없으면 팔 전체가 무리해요. 오늘은 전완과 어깨·날개뼈까지 봤어요.',
    selfCare: ['전완 스트레칭(아픈 쪽) 30초 여러 번', '견갑 후인 운동 가볍게 / ※ 꽉 쥐기·비틀기 반복 금지'],
  },
  {
    key: 'wrist',
    title: '손목 통증',
    subtitle: '상체 원위부의 끝. 팔꿈치처럼 견갑골까지 역추적.',
    translate: [
      { symptom: '시큰/꺾을 때 아픔', meaning: '손목 굴곡·신전근 과사용·수근 정렬' },
      { symptom: '엄지~중지 저림', meaning: '정중신경(손목터널) — Red Flag 확인' },
      { symptom: '새끼손가락 쪽 저림', meaning: '척골신경' },
      { symptom: '마우스·폰 오래 쓰면', meaning: '전완 신전근 과긴장' },
      { symptom: '엄지 아래·손목 옆', meaning: '엄지 근육·건' },
    ],
    emergencyFlags: [
      '외상 후 변형·심한 부종·움직임 불가 (골절)',
      '손가락 힘 빠짐·쥐는 힘 소실·악화되는 저림',
      '발열 동반 부종',
    ],
    beforeChecklist: ['손목 굴곡·신전 각도 확인', '저림 분포(정중/척골) 구분 · 수근·엄지 기저부 압통'],
    measurements: [{ id: 'wristFlexExt', label: '손목 굴곡·신전 각도', unit: '도', sides: 'lr' }],
    steps: [
      { step: 'A', title: '전완·손 이완 (방향별로)', detail: '손목 굴곡근·신전근·엄지 근육·손 내재근' },
      { step: 'B', title: '위를 본다 — 팔꿈치·어깨·견갑 역추적', detail: '전완 회내/회외·팔꿈치·견갑 정렬(소흉근)·라운드숄더' },
      { step: 'C', title: '수근 가동·정렬 점검', detail: '손목 배측/장측 굴곡·요측/척측 편위·수근골 정렬' },
      { step: 'D', title: '안정근 가볍게 활성', detail: '전완·손 내재근·견갑 안정근 가볍게' },
    ],
    adjustRules: [
      '저림 분포 → 정중(손목터널 신중·RedFlag)/척골 구분',
      '마우스·폰 과사용 → 신전근·자세(견갑)↑',
      '라운드숄더 뚜렷 → B(견갑)↑',
    ],
    closingScript:
      '손목은 팔 전체의 맨 끝이라, 손목만 아파도 전완이나 그 위 어깨·자세에서 부하가 내려오는 경우가 많아요. 특히 마우스·폰을 오래 쓰면 어깨가 말리며 팔 전체가 긴장해요. 오늘은 손목·전완과 그 위 정렬까지 봤어요.',
    selfCare: ['전완 스트레칭(굴곡/신전 양방향) 30초 여러 번', '손목 서클·가벼운 가동', '견갑 후인·자세 리셋 / ※ 저림 시 무리한 스트레칭 금지'],
  },
  {
    key: 'upperBack',
    title: '등 통증',
    subtitle: '중심은 흉추 가동. 단, 흉추는 주변이 풀린 뒤 마지막에 연다.',
    translate: [
      { symptom: '등 뻐근/결림', meaning: '흉추 가동 저하 + 견갑 주변 과긴장' },
      { symptom: '날개뼈 사이 아픔', meaning: '능형근·중부승모' },
      { symptom: '등이 굽음/자세 나쁨', meaning: '흉추 굴곡 고착·앞쪽 단축' },
      { symptom: '숨 쉴 때 결림', meaning: '흉곽·늑간 가동 저하' },
      { symptom: '오래 앉으면 아픔', meaning: '흉추 굴곡 고정 + 대흉·소흉 단축' },
    ],
    emergencyFlags: [
      '등에서 가슴·팔로 뻗는 통증 + 식은땀·호흡곤란 (심장 의심)',
      '외상 직후 심한 통증',
      '야간통 + 발열·체중감소',
      '다리 저림·힘 빠짐',
    ],
    beforeChecklist: ['흉추 신전·회전 스트레칭 전후 비교 기준선', '골반-흉추 분리 관찰 / 견갑 사이·능형근 압통'],
    measurements: [
      { id: 'thoracicExtRot', label: '흉추 신전·회전', unit: '도', sides: 'lr' },
      { id: 'pelvisThoracicSeparation', label: '골반-흉추 분리', unit: '정도(0~10)', sides: 'single' },
    ],
    steps: [
      { step: 'A', title: '견갑 주변 이완 (뭉친 곳부터)', detail: '능형근·중부·하부승모·견갑거·광배근' },
      { step: 'B', title: '앞을 연다 — 라운드 원인', detail: '대흉근·소흉근' },
      { step: 'C', title: '늑간·흉곽 — 호흡으로 여는 준비', detail: '늑간·흉곽 가동·호흡 결합' },
      { step: 'D', title: '흉추 가동 시도 (주변 나아진 뒤 마지막에)', detail: '흉추 신전·굴곡·회전 — 전후 비교로 진행 여부 판단' },
      { step: 'E', title: '후방 안정근 가볍게 활성', detail: '중·하부승모·능형근 가볍게 깨움' },
    ],
    adjustRules: [
      '흉추 스트레칭 전후 비교 → 나아지면 계속 / 저항 크면 A~C로 돌아감',
      '골반-흉추 분리 → 흉추 회전 시 골반 따라 돌면 요추가 대신, 골반 고정',
      '자세 많이 굽음 → 앞쪽(대흉·소흉)↑',
    ],
    closingScript:
      '등이 뻐근한 건 등뼈(흉추)가 굳어서인 경우가 많아요. 그런데 등뼈는 갈비뼈·날개뼈에 둘러싸여 있어서, 주변부터 풀어야 잘 움직여요. 오늘은 날개뼈 주변과 앞쪽 가슴을 먼저 풀고, 여건이 됐을 때 등뼈를 펴고 돌려 열었어요.',
    selfCare: ['폼롤러 흉추 신전 1~2분', '문틀 가슴 열기 30초×2', '견갑 후인 10회×2 / ※ 허리 젖혀 등 펴지 않기'],
  },
]

export const XMSK_RECIPE_MAP: Record<XmskRegionKey, XmskRecipe> = Object.fromEntries(
  XMSK_RECIPES.map((r) => [r.key, r]),
) as Record<XmskRegionKey, XmskRecipe>
