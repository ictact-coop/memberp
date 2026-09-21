-- Prisma 스키마 문법으로 표현할 수 없는 무결성 규칙을 raw SQL로 보강한다.

-- v0.1 A06: 기여는 "주 소속 활동 또는 필요" 중 정확히 하나에 속한다.
ALTER TABLE "contributions"
  ADD CONSTRAINT "contributions_activity_or_need_xor"
  CHECK (
    (("activityId" IS NOT NULL)::int + ("needId" IS NOT NULL)::int) = 1
  );

-- v1.0 §7: 시간은 분 단위 정수, 미입력(NULL)과 0을 구별한다 — 음수는 허용하지 않는다.
ALTER TABLE "contributions"
  ADD CONSTRAINT "contributions_minutes_non_negative"
  CHECK ("minutes" IS NULL OR "minutes" >= 0);

ALTER TABLE "activity_assignments"
  ADD CONSTRAINT "activity_assignments_planned_minutes_non_negative"
  CHECK ("plannedMinutes" IS NULL OR "plannedMinutes" >= 0);
