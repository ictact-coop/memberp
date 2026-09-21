import type { PermissionRole, ScopeType } from "@prisma/client";

// v1.0 §3 역할표
export const ROLE_LABELS: Record<PermissionRole, string> = {
  MEMBER: "조합원",
  ACTIVITY_MANAGER: "활동 책임자",
  DOMAIN_OPERATOR: "분야 운영자",
  SECRETARIAT: "사무국",
  FINANCE: "재무 담당자",
  BOARD: "이사회·위원회",
  SYSTEM_ADMIN: "시스템 관리자",
  EXTERNAL_PARTICIPANT: "외부 참여자",
};

export const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  GLOBAL: "전체",
  ACTIVITY: "특정 활동",
  ORG_UNIT: "특정 기구",
};
