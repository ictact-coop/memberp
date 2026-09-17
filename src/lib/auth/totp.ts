import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, generateRecoveryCode, hashToken } from "./crypto";
import { RECOVERY_CODE_COUNT } from "./config";

const ISSUER = "공동체IT 멤버십";

function buildTotp(base32Secret: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

export function createTotpEnrollment(accountEmail: string) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return { base32Secret: secret.base32, otpauthUrl: totp.toString() };
}

export async function renderTotpQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

// 기기 시계 오차를 흡수하기 위해 앞뒤 1스텝(±30초)까지 허용한다.
export function verifyTotpCode(base32Secret: string, code: string): boolean {
  const delta = buildTotp(base32Secret).validate({ token: code.trim(), window: 1 });
  return delta !== null;
}

export async function activateTotp(accountId: string, base32Secret: string): Promise<string[]> {
  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());

  await prisma.$transaction([
    prisma.account.update({
      where: { id: accountId },
      data: {
        totpSecretCiphertext: encryptSecret(base32Secret),
        totpEnabledAt: new Date(),
      },
    }),
    prisma.totpRecoveryCode.deleteMany({ where: { accountId } }),
    prisma.totpRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({ accountId, codeHash: hashToken(code) })),
    }),
  ]);

  return recoveryCodes;
}

export async function verifyTotpForAccount(accountId: string, code: string): Promise<boolean> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account?.totpSecretCiphertext) return false;
  return verifyTotpCode(decryptSecret(account.totpSecretCiphertext), code);
}

export async function consumeRecoveryCode(accountId: string, rawCode: string): Promise<boolean> {
  const codeHash = hashToken(rawCode.trim().toUpperCase());
  const record = await prisma.totpRecoveryCode.findUnique({
    where: { accountId_codeHash: { accountId, codeHash } },
  });
  if (!record || record.usedAt) return false;

  await prisma.totpRecoveryCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return true;
}
