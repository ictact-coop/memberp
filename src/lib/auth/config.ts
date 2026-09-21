import type { PermissionRole } from "@prisma/client";

export const LOGIN_TOKEN_TTL_MINUTES = 15;
export const INVITATION_TTL_DAYS = 7;
export const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE_NAME = "memberp_session";
export const RECOVERY_CODE_COUNT = 10;

// 로그인 요청 속도 제한 — 이메일 한 통마다 발송 비용이 들고, TOTP는 6자리라
// 시도 제한이 없으면 브루트포스가 가능하다.
export const LOGIN_REQUEST_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
export const TOTP_VERIFY_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

// ADR-0002: 이 역할을 하나라도 가진 계정은 로그인 시 TOTP 2단계 인증을 통과해야 한다.
export const ELEVATED_ROLES: PermissionRole[] = [
  "BOARD",
  "FINANCE",
  "SECRETARIAT",
  "SYSTEM_ADMIN",
];

// 로그인·초대 링크를 만들 때 쓰는 절대 주소. 로그인 요청과 초대 발급 양쪽에서 쓴다.
export function getBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) {
    throw new Error("APP_BASE_URL 환경변수가 설정되지 않았습니다.");
  }
  return url;
}
