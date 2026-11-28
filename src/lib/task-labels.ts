import type { TaskStatus } from "@prisma/client";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "예정",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
  CANCELLED: "취소됨",
};

export const TASK_STATUS_BADGE_TONE: Record<TaskStatus, string> = {
  OPEN: "badge-gray",
  IN_PROGRESS: "badge-blue",
  DONE: "badge-green",
  CANCELLED: "badge-red",
};
