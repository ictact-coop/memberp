import type { PermissionRole } from "@prisma/client";

export const LOGIN_TOKEN_TTL_MINUTES = 15;
export const INVITATION_TTL_DAYS = 7;
export const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE_NAME = "memberp_session";
export const RECOVERY_CODE_COUNT = 10;

// ADR-0002: 이 역할을 하나라도 가진 계정은 로그인 시 TOTP 2단계 인증을 통과해야 한다.
export const ELEVATED_ROLES: PermissionRole[] = [
  "BOARD",
  "FINANCE",
  "SECRETARIAT",
  "SYSTEM_ADMIN",
];
