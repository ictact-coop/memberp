import { PrismaClient } from "@prisma/client";

// Next.js가 개발 모드에서 모듈을 다시 로드할 때마다 새 커넥션 풀을 만들지 않도록
// 전역 객체에 캐시한다 (Prisma 공식 권장 패턴).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
