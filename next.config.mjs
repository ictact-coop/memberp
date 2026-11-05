/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone"은 Docker 배포(Dockerfile의 runner 스테이지)가 .next/standalone만
  // 복사해 실행하는 데 필요하다. Vercel은 자기 자신의 빌드 출력 체계를 쓰므로
  // 이 옵션이 있으면 오히려 안 맞는다 — Vercel 빌드에서는 자동으로 VERCEL=1이
  // 설정되므로 그때만 끈다.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
