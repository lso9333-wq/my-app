FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
# 2026-09-14: hand/foot 분석 기능이 새 의존성(@tensorflow-models/hand-pose-detection)을
# 추가했는데, 이 프로젝트를 개발하는 샌드박스는 npm 레지스트리 접근이 막혀 있어
# package-lock.json을 실제로 갱신해보며 커밋할 방법이 없었다(CLAUDE.md 참고) — 그 결과
# package.json과 package-lock.json이 어긋나 `npm ci`가 "Missing ... from lock file"로
# 실패했다. 이 VM의 빌드 환경은 실제 인터넷에 접근할 수 있으므로, 여기서만 `npm ci`
# 대신 `npm install`을 쓴다 — lock 파일이 100% 일치하지 않아도 실제 레지스트리에서
# 새 패키지를 그대로 받아와 설치한다. 재현성이 `npm ci`보다 약간 떨어지지만(빌드마다
# 최신 호환 버전을 다시 계산), 지금처럼 lock 파일을 사전에 검증할 수 없는 패키지를
# 추가한 직후에는 이 방식이 유일한 실용적 해결책이다.
RUN npm install
COPY . .
# 2026-09: 이 프로젝트는 원래 테스트 러너가 없었다(CLAUDE.md 참고) — vitest를 새로
# 추가하면서, 프로덕션 빌드를 만들기 전에 여기서 먼저 테스트를 돌려 실패하면 빌드
# 자체를 중단시킨다. 개발 샌드박스는 npm 레지스트리가 막혀 있어 `npm test`를 직접
# 실행해본 적이 없으므로(다른 새 의존성들과 같은 사정), 이 VM의 첫 실제 빌드에서
# 문제가 드러나면 그 로그를 보고 고치면 된다.
RUN npm test
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm install
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
