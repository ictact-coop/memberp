import type { TaskStatus } from "@prisma/client";

// 활동/필요 상태 전이와 같은 구조(need-status.ts 참고) — 업무는 그 둘보다
// 흐름이 단순해 예정→진행중→완료 또는 취소, 완료·취소에서 다시 열기만 둔다.
export type TaskTransitionAction = "start" | "complete" | "cancel" | "reopen";

interface TaskTransitionRule {
  from: TaskStatus[];
  to: TaskStatus;
  reasonRequired: boolean;
}

export const TASK_TRANSITIONS: Record<TaskTransitionAction, TaskTransitionRule> = {
  start: { from: ["OPEN"], to: "IN_PROGRESS", reasonRequired: false },
  complete: { from: ["OPEN", "IN_PROGRESS"], to: "DONE", reasonRequired: false },
  cancel: { from: ["OPEN", "IN_PROGRESS"], to: "CANCELLED", reasonRequired: true },
  reopen: { from: ["DONE", "CANCELLED"], to: "OPEN", reasonRequired: false },
};

export const TASK_TRANSITION_LABELS: Record<TaskTransitionAction, string> = {
  start: "시작",
  complete: "완료",
  cancel: "취소",
  reopen: "다시 열기",
};

export function availableTaskTransitions(status: TaskStatus): TaskTransitionAction[] {
  return (Object.keys(TASK_TRANSITIONS) as TaskTransitionAction[]).filter((action) =>
    TASK_TRANSITIONS[action].from.includes(status),
  );
}
