import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateToken, hashToken } from "../src/lib/auth/crypto";

const prisma = new PrismaClient();

// 관리자 초대 화면이 아직 없어(추후 구현), 최초 관리자 계정만 이 스크립트로 부트스트랩한다.
// 사용법: npx tsx prisma/bootstrap-admin.ts you@example.org
async function main() {
  const email = process.argv[2];
  if (!email || !email.includes("@")) {
    console.error("사용법: npx tsx prisma/bootstrap-admin.ts <이메일>");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.account.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.error(`이미 등록된 이메일입니다: ${normalizedEmail}`);
    process.exit(1);
  }

  const rawToken = generateToken();
  const invitation = await prisma.invitation.create({
    data: {
      contact: normalizedEmail,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      // 발급자가 없는 부트스트랩 초대이므로 감사 목적의 표식만 남긴다(FK로 강제되지 않음).
      invitedByAccountId: "bootstrap-script",
      suggestedRole: "SYSTEM_ADMIN",
    },
  });

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const acceptUrl = new URL("/api/auth/accept-invitation", baseUrl);
  acceptUrl.searchParams.set("token", rawToken);

  console.log(`초대장 생성 완료 (id=${invitation.id})`);
  console.log(`아래 링크로 가입을 완료하세요 (7일 이내):`);
  console.log(acceptUrl.toString());
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
