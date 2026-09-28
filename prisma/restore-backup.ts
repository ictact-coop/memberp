import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { generateToken, hashToken } from "../src/lib/auth/crypto";

const prisma = new PrismaClient();

// 백업 가져오기(복원) — 병행운영전략 v0.2가 요구하는 "다른 운영자로 이전"을
// 실제로 검증하려면 /admin/backup의 내보내기(export/route.ts)를 다시 읽어
// 새 DB로 넣는 기능이 있어야 하는데, 그동안 없었다.
//
// 왜 화면이 아니라 스크립트인가: 관리자 화면으로 만들면 "누가 실행할 수 있는가"를
// 로그인 역할로 막아야 하는데, 복원이 필요한 상황은 정확히 "아직 로그인할 계정이
// 하나도 없는 새 DB"다 — 역할 검사를 통과할 계정 자체가 없다. 그렇다고 로그인 없이
// 여는 HTTP 엔드포인트를 만들면 그 자체가 데이터를 통째로 갈아치우는 인증 없는
// 공격 표면이 된다. bootstrap-admin.ts(최초 관리자 초대)와 같은 이유로, 서버에
// 직접 접근할 수 있는 사람만 실행하는 CLI 스크립트로 만든다.
//
// 안전장치: 내보내기가 다루는 14개 테이블이 전부 비어 있을 때만 실행된다. 그중
// 하나라도 행이 있으면(이미 부트스트랩 관리자가 로그인해 사람 주체·계정·권한이
// 생겼거나, 실수로 운영 중인 DB에 실행하려는 경우) 아무것도 쓰지 않고 즉시
// 거부한다 — "병합"은 하지 않는다. ID를 그대로 복원하므로 기존 행과 충돌할 수
// 있고, 어느 쪽을 남길지 스크립트가 대신 정할 문제가 아니기 때문이다.
//
// 사용법: npx tsx prisma/restore-backup.ts memberp-backup-....json
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("사용법: npx tsx prisma/restore-backup.ts <백업 JSON 파일 경로>");
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8");
  const payload = JSON.parse(raw);

  const data = payload?.data;
  if (!data || typeof data !== "object") {
    console.error("올바른 백업 파일이 아닙니다 (data 필드가 없습니다).");
    process.exit(1);
  }

  const REQUIRED_KEYS = [
    "subjects",
    "accounts",
    "classifications",
    "activityClassifications",
    "needs",
    "needActivityLinks",
    "activities",
    "activityAssignments",
    "contributions",
    "attachments",
    "notifications",
    "permissionGrants",
    "invitations",
    "auditLogs",
  ] as const;

  const tables: Record<(typeof REQUIRED_KEYS)[number], unknown[]> = {} as never;
  for (const key of REQUIRED_KEYS) {
    const value = data[key];
    if (value !== undefined && !Array.isArray(value)) {
      console.error(`올바른 백업 파일이 아닙니다 (data.${key}가 배열이 아닙니다).`);
      process.exit(1);
    }
    tables[key] = Array.isArray(value) ? value : [];
  }

  console.log(`백업 시각: ${payload.exportedAt ?? "(알 수 없음)"}`);
  console.log("복원할 건수:", Object.fromEntries(REQUIRED_KEYS.map((k) => [k, tables[k].length])));

  await prisma.$transaction(
    async (tx) => {
      const counts = await Promise.all([
        tx.subject.count(),
        tx.account.count(),
        tx.classification.count(),
        tx.activityClassification.count(),
        tx.need.count(),
        tx.needActivityLink.count(),
        tx.activity.count(),
        tx.activityAssignment.count(),
        tx.contribution.count(),
        tx.attachment.count(),
        tx.notification.count(),
        tx.permissionGrant.count(),
        tx.invitation.count(),
        tx.auditLog.count(),
      ]);
      const totalExisting = counts.reduce((sum, n) => sum + n, 0);
      if (totalExisting > 0) {
        throw new Error(
          `대상 DB가 비어 있지 않습니다(기존 행 ${totalExisting}개). ` +
            "복원은 완전히 새 DB에서만 할 수 있습니다 — 기존 데이터와 병합하지 않습니다.",
        );
      }

      // 1단계: 자기 자신을 가리키는 필드(정정 이력·대체·후속 참조)는 일단 비워서
      // 넣는다 — 참조 대상 행이 아직 없을 수 있어서다. 2단계에서 원래 값으로
      // 채운다.
      if (tables.subjects.length > 0) {
        await tx.subject.createMany({ data: tables.subjects as Prisma.SubjectCreateManyInput[] });
      }

      if (tables.accounts.length > 0) {
        // totpEnabledAt은 절대 그대로 복원하지 않는다: 내보내기가 totpSecretCiphertext를
        // (인증 비밀이라) 아예 빼놓으므로, enabledAt만 살아있으면 로그인 흐름이 "이미
        // 등록됨"으로 보고 코드 입력 화면으로 보내는데 확인할 비밀키가 없어 그 계정은
        // 영원히 로그인하지 못하게 된다(src/lib/auth/login.ts의 hasTotpEnrolled 판단
        // 기준). 복구코드도 내보내지 않으므로 우회할 방법도 없다 — 반드시 null로 둬서
        // 다음 로그인 때 재등록(/login/totp/setup)하게 한다.
        const accountsData = (tables.accounts as Record<string, unknown>[]).map((a) => ({
          ...a,
          totpEnabledAt: null,
        }));
        await tx.account.createMany({ data: accountsData as Prisma.AccountCreateManyInput[] });
      }

      if (tables.classifications.length > 0) {
        await tx.classification.createMany({
          data: tables.classifications as Prisma.ClassificationCreateManyInput[],
        });
      }

      const activitiesOriginal = tables.activities as Record<string, unknown>[];
      if (activitiesOriginal.length > 0) {
        const activitiesFirstPass = activitiesOriginal.map((a) => ({
          ...a,
          parentActivityId: null,
          revisionOfId: null,
          supersededByActivityId: null,
        }));
        await tx.activity.createMany({
          data: activitiesFirstPass as Prisma.ActivityCreateManyInput[],
        });
      }

      const needsOriginal = tables.needs as Record<string, unknown>[];
      if (needsOriginal.length > 0) {
        const needsFirstPass = needsOriginal.map((n) => ({ ...n, followsUpOnNeedId: null }));
        await tx.need.createMany({ data: needsFirstPass as Prisma.NeedCreateManyInput[] });
      }

      if (tables.activityAssignments.length > 0) {
        await tx.activityAssignment.createMany({
          data: tables.activityAssignments as Prisma.ActivityAssignmentCreateManyInput[],
        });
      }

      const contributionsOriginal = tables.contributions as Record<string, unknown>[];
      if (contributionsOriginal.length > 0) {
        const contributionsFirstPass = contributionsOriginal.map((c) => ({
          ...c,
          revisionOfId: null,
          supersededByContributionId: null,
        }));
        await tx.contribution.createMany({
          data: contributionsFirstPass as Prisma.ContributionCreateManyInput[],
        });
      }

      const attachmentsOriginal = tables.attachments as Record<string, unknown>[];
      if (attachmentsOriginal.length > 0) {
        const attachmentsFirstPass = attachmentsOriginal.map((a) => ({
          ...a,
          replacesAttachmentId: null,
        }));
        await tx.attachment.createMany({
          data: attachmentsFirstPass as Prisma.AttachmentCreateManyInput[],
        });
      }

      if (tables.notifications.length > 0) {
        await tx.notification.createMany({
          data: tables.notifications as Prisma.NotificationCreateManyInput[],
        });
      }
      if (tables.permissionGrants.length > 0) {
        await tx.permissionGrant.createMany({
          data: tables.permissionGrants as Prisma.PermissionGrantCreateManyInput[],
        });
      }
      if (tables.invitations.length > 0) {
        // tokenHash는 내보내기가 빼놓은 필드다(초대 링크의 원문 토큰은 애초에
        // DB 어디에도 저장하지 않으므로 export가 복원해 줄 수 있는 값이 아니다 —
        // 발송 시점에 한 번 보여주고 끝이다). 필수·유일 제약이라 값이 있어야
        // 하므로, 절대 추측할 수 없는 무작위 해시를 채워 넣는다 — 그 결과 복원된
        // 초대(특히 아직 PENDING인 것)는 이 화면에서 다시 링크를 발급하기 전까지는
        // 아무도 수락할 수 없다. 상태·이력은 그대로 보존된다.
        const invitationsData = (tables.invitations as Record<string, unknown>[]).map((inv) => ({
          ...inv,
          tokenHash: hashToken(generateToken()),
        }));
        await tx.invitation.createMany({
          data: invitationsData as Prisma.InvitationCreateManyInput[],
        });
      }
      if (tables.needActivityLinks.length > 0) {
        await tx.needActivityLink.createMany({
          data: tables.needActivityLinks as Prisma.NeedActivityLinkCreateManyInput[],
        });
      }
      if (tables.activityClassifications.length > 0) {
        await tx.activityClassification.createMany({
          data: tables.activityClassifications as Prisma.ActivityClassificationCreateManyInput[],
        });
      }
      if (tables.auditLogs.length > 0) {
        await tx.auditLog.createMany({ data: tables.auditLogs as Prisma.AuditLogCreateManyInput[] });
      }

      // 2단계: 1단계에서 비워둔 자기 참조 필드를 원래 값으로 채운다. 이 시점에는
      // 참조 대상 행이 모두 존재하므로 안전하다.
      for (const a of activitiesOriginal) {
        if (a.parentActivityId || a.revisionOfId || a.supersededByActivityId) {
          await tx.activity.update({
            where: { id: a.id as string },
            data: {
              parentActivityId: (a.parentActivityId as string | null) ?? null,
              revisionOfId: (a.revisionOfId as string | null) ?? null,
              supersededByActivityId: (a.supersededByActivityId as string | null) ?? null,
            },
          });
        }
      }
      for (const n of needsOriginal) {
        if (n.followsUpOnNeedId) {
          await tx.need.update({
            where: { id: n.id as string },
            data: { followsUpOnNeedId: n.followsUpOnNeedId as string },
          });
        }
      }
      for (const c of contributionsOriginal) {
        if (c.revisionOfId || c.supersededByContributionId) {
          await tx.contribution.update({
            where: { id: c.id as string },
            data: {
              revisionOfId: (c.revisionOfId as string | null) ?? null,
              supersededByContributionId: (c.supersededByContributionId as string | null) ?? null,
            },
          });
        }
      }
      for (const a of attachmentsOriginal) {
        if (a.replacesAttachmentId) {
          await tx.attachment.update({
            where: { id: a.id as string },
            data: { replacesAttachmentId: a.replacesAttachmentId as string },
          });
        }
      }

      // 표시번호 채번(SUB/ACT/NEED/CONT)이 복원된 값과 겹치지 않도록, 복원된
      // displayId 중 가장 큰 번호로 DisplaySequence를 맞춰 둔다 — 안 하면 다음
      // 신규 등록이 SUB-0001부터 다시 시작해 이미 존재하는 표시번호와 충돌한다.
      const maxSuffix = (rows: { displayId: string }[], prefix: string): number =>
        rows.reduce((max, row) => {
          const match = row.displayId.match(new RegExp(`^${prefix}-(\\d+)$`));
          const n = match ? Number(match[1]) : 0;
          return n > max ? n : max;
        }, 0);

      const sequences: [string, { displayId: string }[]][] = [
        ["SUB", tables.subjects as { displayId: string }[]],
        ["ACT", activitiesOriginal as { displayId: string }[]],
        ["NEED", needsOriginal as { displayId: string }[]],
        ["CONT", contributionsOriginal as { displayId: string }[]],
      ];
      for (const [prefix, rows] of sequences) {
        const max = maxSuffix(rows, prefix);
        if (max > 0) {
          await tx.displaySequence.upsert({
            where: { prefix },
            create: { prefix, lastValue: max },
            update: { lastValue: max },
          });
        }
      }

      const restoredCounts = Object.fromEntries(REQUIRED_KEYS.map((k) => [k, tables[k].length]));
      await tx.auditLog.create({
        data: {
          entityType: "Backup",
          entityId: "ALL",
          action: "IMPORT",
          actorAccountId: null,
          afterData: { ...restoredCounts, sourceExportedAt: payload.exportedAt ?? null },
          reason: "전체 데이터 복원 (스크립트, restore-backup.ts)",
        },
      });
    },
    { maxWait: 30_000, timeout: 120_000 },
  );

  console.log("복원 완료.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
