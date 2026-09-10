export type InfoKey = 'terms' | 'privacy' | 'about' | 'contact' | 'faq'

export const FOOTER_LINKS: { key: InfoKey; label: string }[] = [
  { key: 'terms', label: '이용약관' },
  { key: 'privacy', label: '개인정보처리방침' },
  { key: 'about', label: '소개' },
  { key: 'contact', label: '문의하기' },
  { key: 'faq', label: '자주 묻는 질문' },
]

export interface InfoSection {
  title: string
  body: string[]
}

export interface InfoPage {
  title: string
  sections: InfoSection[]
}

export const INFO_PAGES: Record<InfoKey, InfoPage> = {
  terms: {
    title: '이용약관',
    sections: [
      {
        title: '서비스 성격',
        body: [
          'MyDoctor는 촬영한 영상을 바탕으로 보행·스트레칭 가동범위를 분석해 보여주는 참고용 도구입니다.',
          '분석 결과는 의료적 진단이나 전문가의 평가를 대체하지 않습니다. 통증이나 이상이 있다면 반드시 의료 전문가와 상담하세요.',
        ],
      },
      {
        title: '이용 범위',
        body: [
          'XMSK(통증 레시피·근육 사전·평가표)는 트레이너 전용 기능으로, 비밀번호로 접근이 제한됩니다.',
          '서비스는 사전 고지 없이 변경되거나 일시 중단될 수 있습니다.',
        ],
      },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    sections: [
      {
        title: '보행 분석',
        body: ['업로드한 영상과 프레임별 포즈 데이터는 브라우저 안에서만 처리되며, 서버로 전송되지 않습니다.'],
      },
      {
        title: 'ROM(가동범위) 분석',
        body: [
          '영상 자체는 서버로 전송되지 않습니다.',
          '계산이 끝난 수치 결과(관절 각도 등)만 기록 저장을 위해 서버로 전송됩니다.',
        ],
      },
      {
        title: 'XMSK',
        body: ['트레이너가 입력한 회원 이름, 측정값, 평가 기록이 서버에 저장되며, 트레이너 인증 후에만 조회할 수 있습니다.'],
      },
      {
        title: '수집 목적',
        body: ['수집한 정보는 서비스 제공과 기록 조회 목적으로만 사용되며, 제3자에게 제공되지 않습니다.'],
      },
    ],
  },
  about: {
    title: '소개',
    sections: [
      {
        title: 'MyDoctor란',
        body: ['핸드폰으로 촬영한 영상만으로 보행과 스트레칭 가동범위를 분석하는 참고용 웹 도구입니다.'],
      },
      {
        title: '제공 기능',
        body: [
          '보행 분석 — 케이던스, 걸음 간격, 보폭, 좌우 대칭성, 좌우 흔들림을 계산합니다.',
          '스트레칭 ROM 분석 — 스트레칭 전/후 관절 가동범위 변화를 계산합니다.',
          'XMSK — 트레이너를 위한 통증 레시피, 근육 사전, 현장투입 평가표를 제공합니다.',
        ],
      },
    ],
  },
  contact: {
    title: '문의하기',
    sections: [
      {
        title: '연락처',
        body: ['서비스 관련 문의는 아래 이메일로 보내주세요.', 'lso9333@gmail.com'],
      },
    ],
  },
  faq: {
    title: '자주 묻는 질문',
    sections: [
      {
        title: '촬영한 영상이 서버에 저장되나요?',
        body: ['아니요. 보행·ROM 분석 모두 영상 자체는 브라우저에서만 처리됩니다. ROM 분석은 계산된 수치만 저장 목적으로 서버에 전송됩니다.'],
      },
      {
        title: '의료 진단 결과인가요?',
        body: ['아니요. 참고용 도구이며 전문가의 진단이나 평가를 대체하지 않습니다.'],
      },
      {
        title: '어떤 영상을 올려야 정확한가요?',
        body: ['옆에서 촬영해 전신이 잘 보이는 영상이 가장 정확합니다.'],
      },
      {
        title: 'XMSK는 누구나 쓸 수 있나요?',
        body: ['아니요. 트레이너 전용 기능으로, 비밀번호 인증이 필요합니다.'],
      },
    ],
  },
}
