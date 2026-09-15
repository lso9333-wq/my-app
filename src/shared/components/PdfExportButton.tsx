import type { RefObject } from 'react'

interface Props {
  /** PDF로 내보낼 대상 요소. 이 요소만 인쇄 대화상자에 보이도록 표시한다. */
  targetRef: RefObject<HTMLElement | null>
  /** 인쇄 대화상자의 "PDF로 저장"이 제안하는 파일명(브라우저가 document.title을 참고한다). */
  fileName: string
  label?: string
}

/**
 * 카카오톡 등 "인앱 브라우저"(자체 앱 안에 내장된 웹뷰)는 보안/정책상 `window.print()`
 * 자체를 완전히 무시하는 경우가 많다 — 실제로 사용자가 카카오톡에서 링크를 열어
 * 테스트했을 때 버튼을 눌러도 아무 반응이 없는 것으로 확인됐다. 이건 이 앱의 코드로
 * 고칠 수 있는 문제가 아니라(웹뷰 자체가 인쇄 대화상자를 지원하지 않음) 사용자를 실제
 * 브라우저(사파리/크롬)로 내보내야 한다. 카카오톡은 자체적으로
 * `kakaotalk://web/openExternal?url=...` 스킴을 지원해 현재 페이지를 기본 브라우저로
 * 열어주므로, 카카오톡 인앱 브라우저로 감지되면 인쇄 버튼 대신 이 스킴으로 이동하는
 * 안내 버튼을 보여준다.
 */
function isKakaoTalkInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /KAKAOTALK/i.test(navigator.userAgent)
}

function openInExternalBrowserFromKakaoTalk() {
  const url = window.location.href
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
}

/**
 * "이 요소만 인쇄하기" 기법은 보통 CSS의 `body * { visibility:hidden }` +
 * `.printable-report-active { position:absolute }` 조합으로 구현하는데(App.css),
 * 이건 데스크톱 Chrome에서는 잘 동작하지만 두 가지 약점이 있다: (1) `visibility:hidden`은
 * 안 보이게만 할 뿐 문서 흐름 안에서 차지하는 공간은 그대로 남겨, 인쇄 대상 주변에
 * 화면상 아주 긴 형제 요소(예: 방금 분석한 영상/차트, 긴 기록 목록)가 있으면 실제로는
 * 아무 것도 그려지지 않는 뒷부분에 빈 페이지가 추가로 생긴다. (2) 이를 CSS만으로
 * 고치려면 `:has()` 선택자가 필요한데, 데스크톱 최신 Chrome/Safari는 지원해도 일부
 * 안드로이드 기기의 시스템 웹뷰(Chrome 버전이 뒤처진 경우가 흔하다)는 아직 지원하지
 * 않을 수 있고, `:has()`를 이해하지 못하는 브라우저는 그 규칙 전체를 무시해버려
 * 사실상 안드로이드에서만 이 보호 장치가 조용히 빠지는 결과가 된다.
 *
 * 그래서 CSS와는 별개로, 클릭 시점에 JS로 직접 "인쇄 대상의 조상 체인만 남기고 나머지
 * 형제들은 `display:none`으로 문서 흐름에서 완전히 제거"하는 훨씬 오래되고 광범위하게
 * 호환되는 기법을 함께 적용한다 — 특정 CSS 기능 지원 여부와 무관하게 항상 동작한다.
 * 인쇄 대상에서 시작해 `<body>`까지 조상을 하나씩 올라가며, 매 단계에서 "그 조상의
 * 형제들"에 인라인 `display:none`을 걸고, 인쇄가 끝나면 원래 인라인 스타일로 되돌린다.
 */
function isolateForPrint(target: HTMLElement): () => void {
  const restores: Array<() => void> = []
  let node: HTMLElement | null = target

  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (parent) {
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === node || !(sibling instanceof HTMLElement)) return
        const prevDisplay = sibling.style.display
        sibling.style.setProperty('display', 'none', 'important')
        restores.push(() => {
          sibling.style.display = prevDisplay
        })
      })
    }
    node = parent
  }

  return () => {
    restores.forEach((restore) => restore())
  }
}

/**
 * 별도 PDF 라이브러리 없이 브라우저 내장 인쇄 기능("인쇄 → PDF로 저장")으로 결과를
 * PDF로 내보낸다. 이 프로젝트는 테스트 러너도 없이 의존성을 최소로 유지하는 방침이고,
 * 개발 환경에서 새 npm 패키지를 추가하면 package-lock.json을 실제로 설치해보며
 * 갱신할 방법이 없어(네트워크가 막힌 샌드박스) 검증되지 않은 lock 파일을 커밋하게
 * 되므로, 모든 브라우저가 이미 지원하는 인쇄 기능을 재사용하는 쪽을 택했다.
 *
 * `targetRef`가 가리키는 요소에 `printable-report-active` 클래스를 잠깐 붙이면
 * (App.css의 `@media print` 규칙) 인쇄 시 그 요소만 보이고 나머지 화면은 숨겨진다 —
 * 여러 개의 결과 패널이 동시에 화면에 떠 있어도(예: 방금 분석한 결과 + 과거 기록
 * 상세보기) 클릭한 패널 하나만 인쇄되도록, 클릭할 때만 그 요소에 클래스를 붙이고
 * 인쇄가 끝나면 바로 뗀다(상시 클래스가 아니라 클릭 시점에만 표시).
 */
export function PdfExportButton({ targetRef, fileName, label = 'PDF로 다운로드' }: Props) {
  if (isKakaoTalkInAppBrowser()) {
    return (
      <button
        type="button"
        className="pdf-export-button pdf-export-button-kakao no-print"
        onClick={openInExternalBrowserFromKakaoTalk}
      >
        카카오톡에서는 PDF 저장이 제한돼요 — 외부 브라우저로 열기
      </button>
    )
  }

  const handleClick = () => {
    const el = targetRef.current
    if (!el) return

    const prevTitle = document.title
    document.title = fileName
    el.classList.add('printable-report-active')
    const restoreSiblings = isolateForPrint(el)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      el.classList.remove('printable-report-active')
      restoreSiblings()
      document.title = prevTitle
    }
    // 실제로 재현된 문제: 안드로이드 크롬은 `window.print()`를 호출하면 인쇄용
    // 웹뷰 렌더링이 아니라 OS 자체의 "인쇄" 화면(별도 시스템 액티비티)으로 넘어가는데,
    // 이때 `afterprint` 이벤트가 그 OS 화면이 실제로 페이지 내용을 캡처/렌더링하기
    // *한참 전에* — 그러니까 인쇄 요청을 안드로이드에 넘겨준 시점에 곧바로 — 발생하는
    // 경우가 있다. 그 순간 cleanup()으로 `printable-report-active`를 바로 떼어버리면,
    // 실제 OS 인쇄 화면이 페이지를 캡처할 때는 이미 원래 상태(아무 것도 안 보이는
    // 상태)로 돌아가 있어 완전히 빈 페이지가 찍힌다(사용자 기기에서 실제로 이 증상이
    // 재현됨 — 버튼을 정확히 눌렀는데도 내용이 비어 있었다). 그래서 `afterprint`가
    // 오더라도 곧바로 정리하지 않고 몇 초 더 기다렸다가 정리한다 — `afterprint`가
    // 아예 오지 않는 경우에 대비한 상한선도 더 넉넉하게 늘렸다. 이 클래스는
    // `@media print` 밖에서는 아무 효과가 없으므로(App.css 참고) 정리가 몇 초 늦어져도
    // 화면상 전혀 티가 나지 않는다.
    const onAfterPrint = () => {
      window.removeEventListener('afterprint', onAfterPrint)
      window.setTimeout(cleanup, 4000)
    }
    window.addEventListener('afterprint', onAfterPrint)
    window.setTimeout(cleanup, 10000)

    // 중요: window.print()는 반드시 클릭 핸들러 안에서 "동기적으로" 호출해야 한다.
    // 한때 캡처 타이밍 문제를 의심해 requestAnimationFrame으로 호출을 한 틱 늦춰봤지만,
    // 그렇게 하면 브라우저가 이 호출을 더 이상 "사용자가 직접 누른" 것으로 간주하지
    // 않아(특히 iOS Safari 등 모바일 브라우저는 print()/alert() 같은 대화상자성 API를
    // 사용자 제스처의 동기 콜스택 안에서 호출했을 때만 허용한다) 버튼을 눌러도 아무
    // 반응이 없어지는 회귀가 발생했다(실제로 확인됨). 그래서 지연 없이 바로 호출한다 —
    // 클래스 추가로 인한 스타일 갱신은 브라우저가 print() 호출 시점의 최신 DOM/스타일
    // 상태를 반영해 인쇄 레이아웃을 계산하므로 별도 리플로우 강제 없이도 반영된다.
    window.print()
  }

  return (
    <button type="button" className="pdf-export-button no-print" onClick={handleClick}>
      {label}
    </button>
  )
}
