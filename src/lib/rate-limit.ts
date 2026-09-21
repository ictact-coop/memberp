import { prisma } from "@/lib/prisma";

export type RateLimitScope = "login_request" | "totp_verify";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

// 로그인 요청 속도 제한 — Redis 없이 Postgres 표 하나로 처리한다(ADR-0001).
// 시도 하나당 행 하나를 남기고, 창 밖으로 나간 오래된 행은 이번 확인에서 같은
// (scope, key)에 대해 지워 표가 무한정 커지지 않게 한다.
//
// 허용 여부와 무관하게 시도 자체는 항상 기록해야 한다 — 그래야 "허용 한도 안에서
// 계속 틀리기"로 제한을 우회할 수 없다. 그래서 허용 시에도, 거부 시에도 이 함수를
// 부르는 쪽에서 결과와 관계없이 매 시도마다 호출해야 한다.
export async function checkRateLimit(
  scope: RateLimitScope,
  key: string,
  { limit, windowMs }: RateLimitOptions,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  const count = await prisma.rateLimitAttempt.count({
    where: { scope, key, createdAt: { gte: windowStart } },
  });
  if (count >= limit) {
    return false;
  }

  await prisma.$transaction([
    prisma.rateLimitAttempt.create({ data: { scope, key } }),
    prisma.rateLimitAttempt.deleteMany({ where: { scope, key, createdAt: { lt: windowStart } } }),
  ]);
  return true;
}
