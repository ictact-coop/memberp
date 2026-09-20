/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 배포(Dockerfile의 runner 스테이지)가 .next/standalone만 복사해
  // 실행하므로, 프로덕션 빌드에서 이 출력을 만들도록 한다.
  output: "standalone",
};

export default nextConfig;
