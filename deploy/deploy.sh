#!/usr/bin/env bash
#
# MyDoctor(memorphia.shop) 배포 스크립트 (v5 — VM에 git 자동 커밋 추가)
#
# v5에서 바뀐 점(2026-09-15): 이 프로젝트가 git 저장소가 아니어서 배포 이력을 조회하거나
# 이전 버전으로 되돌릴 방법이 없었다("인프라 개선" 요청으로 도입). 이제 docker compose
# 빌드 직전에 VM(~/my-app) 안에서 git으로 이번에 배포한 내용을 커밋해둔다 — 새 계정이나
# 인증 정보가 전혀 필요 없다(이 VM 로컬 저장소 하나로만 관리, GitHub 등 외부 연결 없음).
# 나중에 되돌리고 싶으면 VM에 ssh로 들어가 `cd ~/my-app && git log --oneline`으로
# 배포 이력을 보고 `git checkout <커밋> -- . && docker compose build && docker compose up -d`
# 로 그 시점 코드로 되돌린 뒤 재배포하면 된다.
#
# v4에서 바뀐 점(2026-09-14): zip 최상위 항목이 "src" 하나뿐인 경우(바뀐 파일이
# 전부 src/ 밑에만 있을 때) 예전 v3는 이걸 "감싸는 폴더"로 착각해 한 번 더
# 풀어버려서 실제로는 ~/my-app/features/... 처럼 엉뚱한 경로에 올라가는 조용한
# 배포 실패가 있었다. 지금 이 파일을 실행하고 있다면 이미 v4 이상이니 안전하다 —
# 실행하면 아래 "배포 스크립트 버전" 줄로 바로 확인 가능하다.
#
# 압축 풀기 / chmod +x / 폴더명 직접 입력이 전부 필요 없습니다. 이 파일을 zip이 있는
# 곳(Cloud Shell이면 홈 디렉토리 — 업로드하면 자동으로 여기에 들어감)에 두고 실행하세요.
#
#   가장 쉬운 방법 — 인자 없이 실행:
#     bash deploy.sh
#     → 이 스크립트가 있는 폴더(그리고 다운로드 폴더, 현재 폴더)에서 가장 최근에 받은
#       mydoctor-*.zip 파일을 자동으로 찾습니다. 어떤 파일을 찾았는지 보여주고
#       확인(Enter)을 받은 뒤에만 배포를 진행합니다 — 예전 zip이 여러 개 쌓여 있어도
#       엉뚱한 걸 배포할 위험이 없도록 하기 위함입니다.
#
#   특정 zip을 확실히 지정하고 싶을 때(옛날 zip이 여러 개 있을 때 더 안전함):
#     bash deploy.sh mydoctor-groundtruth-feature.zip
#     (Cloud Shell에서는 "bash deploy.sh mydoc"까지 치고 Tab을 누르면 자동완성됩니다)
#
#   (예전처럼 이미 압축을 풀어둔 폴더를 넘겨도 계속 동작합니다)
#     bash deploy.sh mydoctor-groundtruth-feature
#
# 인자로 파일을 직접 지정했을 때는 확인 없이 바로 진행합니다(사용자가 이미 확실히
# 골랐으므로). 인자 없이 자동 탐지했을 때만 확인을 받습니다.
#
# "bash deploy.sh"로 실행하면 실행 권한(chmod +x)도 필요 없습니다.
#
# 전제 조건: gcloud CLI가 설치·로그인되어 있는 환경에서 실행해야 합니다 — Google Cloud
# Shell이면 이미 다 되어 있어 별도 설정이 필요 없습니다. zip을 직접 넘길 경우 unzip
# 명령도 필요합니다(Cloud Shell·macOS·대부분의 Linux 배포판에 기본 포함).
#
# 주의: "~/my-app"은 이 스크립트를 실행하는 컴퓨터(Cloud Shell 등)가 아니라 배포 대상
# VM(아래 INSTANCE_NAME) 안의 경로입니다. 이 스크립트를 실행하는 쪽에서 직접
# "cd ~/my-app"을 칠 필요는 없습니다 — gcloud compute scp/ssh가 알아서 그 VM 안으로
# 들어가 처리합니다.
#
# scp는 "복사"만 하고 "삭제"는 하지 않습니다 — zip/폴더에 없는 나머지 프로젝트 파일은
# VM에 그대로 남고, 겹치는 파일만 덮어씁니다.

set -euo pipefail

echo "배포 스크립트 버전: v5 (VM에 git 자동 커밋 추가, 2026-09-15)"

# ── 이 프로젝트의 고정값 — 인스턴스를 새로 만들거나 이사하지 않는 한 바꿀 일이 없습니다. ──
INSTANCE_NAME="instance-20260908-021158"
ZONE="us-central1-a"
REMOTE_APP_DIR="~/my-app"
ZIP_NAME_PATTERN="mydoctor-*.zip"

TMP_EXTRACT_DIR=""
cleanup() {
  if [ -n "$TMP_EXTRACT_DIR" ] && [ -d "$TMP_EXTRACT_DIR" ]; then
    rm -rf "$TMP_EXTRACT_DIR"
  fi
}
trap cleanup EXIT

# ── 1) 무엇을 배포할지 결정: 인자로 받은 것, 또는 자동으로 찾은 최신 zip ──────────
find_latest_zip() {
  # 이 스크립트가 있는 폴더, 다운로드 폴더, 현재 폴더 순으로 뒤져서 가장 최근에
  # 받은 mydoctor-*.zip을 하나 고른다. 여러 후보 중 mtime이 가장 최신인 것을 쓴다.
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local candidates=()
  for dir in "$script_dir" "$HOME/Downloads" "$(pwd)"; do
    [ -d "$dir" ] || continue
    while IFS= read -r -d '' f; do
      candidates+=("$f")
    done < <(find "$dir" -maxdepth 1 -type f -iname "$ZIP_NAME_PATTERN" -print0 2>/dev/null)
  done
  if [ ${#candidates[@]} -eq 0 ]; then
    return 1
  fi
  # 수정시각 기준 가장 최근 파일 하나 선택. `ls -t`는 macOS(BSD)/Linux(GNU) 양쪽에서
  # 모두 동작하므로(stat의 옵션 문자는 두 진영이 서로 달라 이쪽이 더 안전하다) 이걸 쓴다.
  ls -t "${candidates[@]}" 2>/dev/null | head -n1
}

INPUT="${1:-}"

if [ -z "$INPUT" ]; then
  echo "인자가 없어 최근에 받은 mydoctor-*.zip을 자동으로 찾아봅니다..."
  INPUT="$(find_latest_zip || true)"
  if [ -z "$INPUT" ]; then
    echo "오류: mydoctor-*.zip 파일을 찾지 못했습니다." >&2
    echo "      zip을 받은 뒤 다시 실행하거나, 경로를 직접 인자로 넘겨주세요:" >&2
    echo "      bash deploy.sh mydoctor-xxx.zip" >&2
    exit 1
  fi
  # 지금까지 받은 zip이 여러 개 쌓여있을 수 있으므로(예: Cloud Shell 홈 디렉토리),
  # 자동으로 고른 파일이 맞는지 파일명과 수정 시각을 보여주고 확인을 받는다 —
  # 옛날 zip을 실수로 다시 배포해버리는 사고를 막기 위함. 인자로 직접 지정했을 때는
  # 이미 사용자가 확실히 고른 것이므로 이 확인을 건너뛴다.
  echo ""
  echo "→ 찾은 파일: $INPUT"
  ls -l "$INPUT" 2>/dev/null | awk '{print "   수정 시각/크기: " $6, $7, $8, "· " $5 "bytes"}'
  echo ""
  read -r -p "이 파일로 배포를 진행할까요? 맞으면 Enter, 아니면 Ctrl+C로 취소하세요: " _confirm
fi

if [ ! -e "$INPUT" ]; then
  echo "오류: '$INPUT' 경로를 찾을 수 없습니다." >&2
  exit 1
fi

# ── 2) zip이면 임시 폴더에 풀고, 이미 폴더면 그대로 사용 ─────────────────────────
if [ -f "$INPUT" ] && [[ "$INPUT" == *.zip ]]; then
  if ! command -v unzip >/dev/null 2>&1; then
    echo "오류: unzip 명령을 찾을 수 없습니다. zip을 직접 넘기려면 unzip이 필요합니다" >&2
    echo "      (또는 미리 압축을 푼 폴더 경로를 대신 넘겨주세요)." >&2
    exit 1
  fi
  TMP_EXTRACT_DIR="$(mktemp -d)"
  echo "── zip 압축을 풀고 있습니다..."
  unzip -q "$INPUT" -d "$TMP_EXTRACT_DIR"
  # zip 안에 최상위 폴더가 "감싸는(wrapper)" 폴더 하나뿐인 구조(예전에 프로젝트
  # 전체를 통째로 담았던 myapp.zip류처럼 "my-app-restructured/src/...")라면 그
  # 폴더를 배포 대상으로 써야 하지만, 최근처럼 바뀐 파일만 담은 zip이 우연히
  # "src/features/home/..."처럼 최상위 항목이 "src" 하나뿐인 경우도 있다 — 이건
  # 감싸는 폴더가 아니라 이미 올바른 프로젝트 루트 상대 경로이므로 절대 한 번 더
  # "풀어서(unwrap)" 올리면 안 된다(실제로 2026-09-14 히어로 일러스트 배포에서 이
  # 버그로 src/features/home/HeroSection.tsx가 아니라 엉뚱하게 my-app/features/...
  # 로 올라가 버려 배포가 "성공"으로 보였는데도 실제 파일은 안 바뀌는 사고가 있었다).
  # 그래서 최상위 항목이 하나뿐이어도, 그 이름이 이 프로젝트의 알려진 최상위
  # 폴더/파일명과 같으면 "이미 올바른 루트"로 보고 풀지 않는다.
  KNOWN_ROOT_ENTRIES=(
    src server deploy public data scripts docs
    package.json package-lock.json Dockerfile docker-compose.yml Caddyfile
    vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json
    index.html CLAUDE.md .env.production .dockerignore .gitignore
  )
  shopt -s nullglob
  TOP_ENTRIES=("$TMP_EXTRACT_DIR"/*)
  shopt -u nullglob
  IS_KNOWN_ROOT_NAME=0
  if [ ${#TOP_ENTRIES[@]} -eq 1 ]; then
    TOP_BASENAME="$(basename "${TOP_ENTRIES[0]}")"
    for known in "${KNOWN_ROOT_ENTRIES[@]}"; do
      if [ "$TOP_BASENAME" = "$known" ]; then
        IS_KNOWN_ROOT_NAME=1
        break
      fi
    done
  fi
  if [ ${#TOP_ENTRIES[@]} -eq 1 ] && [ -d "${TOP_ENTRIES[0]}" ] && [ "$IS_KNOWN_ROOT_NAME" -eq 0 ]; then
    LOCAL_DIR="${TOP_ENTRIES[0]}"
  else
    LOCAL_DIR="$TMP_EXTRACT_DIR"
  fi
elif [ -d "$INPUT" ]; then
  LOCAL_DIR="$INPUT"
else
  echo "오류: '$INPUT'은(는) zip 파일도 폴더도 아닙니다." >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "오류: gcloud CLI를 찾을 수 없습니다. 이 컴퓨터에 Google Cloud SDK가 설치·로그인되어 있어야 합니다." >&2
  exit 1
fi

# ── 3) 바뀐 파일을 VM으로 복사 ─────────────────────────────────────────────────
shopt -s dotglob nullglob
ENTRIES=("$LOCAL_DIR"/*)
shopt -u dotglob nullglob
if [ ${#ENTRIES[@]} -eq 0 ]; then
  echo "오류: '$LOCAL_DIR' 폴더가 비어 있습니다." >&2
  exit 1
fi

echo "── 1/2: 바뀐 파일을 VM(${INSTANCE_NAME})의 ${REMOTE_APP_DIR} 안으로 복사합니다..."
gcloud compute scp --recurse "${ENTRIES[@]}" \
  "${INSTANCE_NAME}:${REMOTE_APP_DIR}/" \
  --zone="${ZONE}"

# ── 2) VM에서 이번 배포 내용을 git으로 커밋한 뒤 docker compose로 재기동 ─────────────
# ZIP_LABEL: 커밋 메시지에 "무엇을 배포했는지"가 남도록 zip 파일명(확장자 제외)을 쓴다.
ZIP_LABEL="$(basename "$INPUT")"
ZIP_LABEL="${ZIP_LABEL%.zip}"
DEPLOY_TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

# 아래 REMOTE_CMD는 VM 안에서(gcloud compute ssh를 통해) 실행될 스크립트를 하나의
# 문자열로 만든다. `<<EOF`(따옴표 없음)이라 ${REMOTE_APP_DIR}/${ZIP_LABEL}/${DEPLOY_TIMESTAMP}는
# 지금 이 로컬 스크립트가 값을 채워 넣지만, `\$(...)`처럼 백슬래시를 붙인 부분은
# 그대로 VM에 전달돼 VM 쪽 셸이 실행한다.
read -r -d '' REMOTE_CMD <<EOF || true
set -e
cd ${REMOTE_APP_DIR}

if [ ! -d .git ]; then
  echo "── (최초 1회) ${REMOTE_APP_DIR}을 git 저장소로 초기화합니다..."
  git init -q
  git config user.email "deploy@memorphia.shop"
  git config user.name "MyDoctor Deploy"
  if [ ! -f .gitignore ]; then
    cat > .gitignore <<'GITIGNORE'
node_modules
dist
server/data/*.db
.env
.env.production
GITIGNORE
  fi
  git add -A
  git commit -q -m "초기 커밋 (배포 자동화 도입 시점의 기존 상태)" || true
fi

git add -A
if git diff --cached --quiet; then
  echo "── (git: 추적 대상 중 변경된 파일 없음 — 커밋 생략)"
else
  git commit -q -m "배포: ${ZIP_LABEL} (${DEPLOY_TIMESTAMP})"
  echo "── git 커밋 완료: \$(git log -1 --oneline)"
fi

# VM의 git 커밋이 로컬(예: ~/my-app-real)의 GitHub master 클론과 어긋나지 않도록,
# 커밋 여부와 무관하게(이전 실행에서 커밋만 되고 push가 안 남아있을 수도 있으므로)
# 매번 push를 시도한다. origin이 없으면(예전 VM-로컬-전용 저장소) 건너뛴다. push
# 실패는 배포 자체(docker compose)를 막지 않되, 눈에 띄게 경고한다 — 조용히
# 무시하면 이번에 잡은 것과 같은 종류의 어긋남이 다시 재발할 수 있다.
if git remote get-url origin >/dev/null 2>&1; then
  if git push origin master; then
    echo "── git push 완료 (GitHub master와 동기화됨)"
  else
    echo "⚠️  git push 실패 — VM의 git 이력이 GitHub master와 어긋난 상태로 남았습니다. 수동으로 확인/push하세요." >&2
  fi
else
  echo "── (git: origin 리모트가 없어 push를 건너뜁니다)"
fi

docker compose build && docker compose up -d
EOF

echo "── 2/2: VM에서 git 커밋 후 docker compose build && docker compose up -d 실행합니다..."
gcloud compute ssh "${INSTANCE_NAME}" \
  --zone="${ZONE}" \
  --command="${REMOTE_CMD}"

echo ""
echo "배포 완료. https://memorphia.shop 에서 확인해 보세요."
