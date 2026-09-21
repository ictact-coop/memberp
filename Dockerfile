# memberp 배포용 Dockerfile — 3단계 빌드
# 1) deps: 의존성만 설치해 이후 소스 변경 시에도 이 레이어를 캐시로 재사용
# 2) builder: Prisma client 생성 + Next.js standalone 빌드
#    (devDependencies가 포함된 이 스테이지는 docker-compose.yml의 migrate
#    서비스가 `prisma migrate deploy`를 실행하는 데도 그대로 재사용된다 —
#    런타임 이미지에는 prisma CLI를 넣지 않기 위함)
# 3) runner: standalone 출력만 담은 최소 런타임 이미지

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/storage/attachments \
  && chown -R nextjs:nodejs /app/storage

# 이 프로젝트에는 public/ 디렉터리가 없다(정적 자산 없음 — 폰트는 CDN 링크,
# 유일한 <img>도 서버가 만든 data URL이다) — 있지도 않은 경로를 COPY하면 빌드
# 자체가 실패한다.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
