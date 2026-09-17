import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
// 0/O, 1/I처럼 헷갈리는 문자를 뺀 알파벳 — 복구코드를 손으로 옮겨 적을 때의 오류를 줄인다.
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// 초대장·로그인 링크·복구코드는 전부 이 해시로 저장한다: DB가 유출되어도
// 그 자체로 로그인에 재사용될 수 없게 하기 위함이다(원문은 저장하지 않는다).
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateRecoveryCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) {
    code += RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

function getEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOTP_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY는 base64로 인코딩된 32바이트 값이어야 합니다.");
  }
  return key;
}

// TOTP 비밀키를 평문으로 저장하지 않는다. 키가 유출되면 이 암호화도 무의미해지므로
// TOTP_ENCRYPTION_KEY는 코드 저장소가 아니라 배포 환경의 비밀값으로만 관리해야 한다.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, ciphertext, authTag].map((buf) => buf.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, ciphertextB64, authTagB64] = stored.split(".");
  if (!ivB64 || !ciphertextB64 || !authTagB64) {
    throw new Error("잘못된 암호문 형식입니다.");
  }
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
