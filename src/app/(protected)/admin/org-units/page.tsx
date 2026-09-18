import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_LABELS } from "@/lib/activity-labels";
import { SUBJECT_STATUS_LABELS } from "@/lib/subject-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "기구 이름을 입력하세요.",
  invalid_responsible: "선택한 책임 담당자 계정을 확인할 수 없습니다.",
};

// 기구(Subject type=ORG_UNIT) 등록 — v0.1 P01 "유형: 사람/법인·외부단체/내부팀/
// 자치기구". 지금까지는 DB를 직접 조작해야만 기구를 만들 수 있었다(역할 관리
// 화면의 "기구" 범위 선택형이 이미 기구 목록을 참조하고 있었지만, 등록 화면은
// 없었다). SECRETARIAT/SYSTEM_ADMIN만 들어올 수 있다(/admin의 다른 화면과 같음).
export default async function OrgUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error } = await searchParams;

  const [orgUnits, archivedOrgUnits, accounts] = await Promise.all([
    prisma.subject.findMany({
      where: { type: "ORG_UNIT", archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: { type: "ORG_UNIT", archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
    }),
    prisma.account.findMany({
      where: { status: "ACTIVE" },
      orderBy: { email: "asc" },
      select: { id: true, email: true, phone: true },
    }),
  ]);

  const responsibleIds = Array.from(
    new Set(
      [...orgUnits, ...archivedOrgUnits]
        .map((o) => o.responsibleAccountId)
        .filter((id): id is string => id !== null),
    ),
  );
  const responsibleAccounts = await prisma.account.findMany({
    where: { id: { in: responsibleIds } },
    select: { id: true, email: true, phone: true },
  });
  const responsibleLabelById = new Map(
    responsibleAccounts.map((a) => [a.id, a.email ?? a.phone ?? a.id]),
  );

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>기구 관리</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <h2 style={{ fontSize: 16 }}>새 기구 등록</h2>
      <form method="POST" action="/api/admin/org-units/create" style={{ marginBottom: 24 }}>
        <label htmlFor="name" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          이름
        </label>
        <input
          id="name"
          name="name"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="region" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          지역 (선택)
        </label>
        <input
          id="region"
          name="region"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="expertiseTags" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          전문영역·관심 (선택, 쉼표로 구분)
        </label>
        <input
          id="expertiseTags"
          name="expertiseTags"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="responsibleAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          책임 담당자 (선택)
        </label>
        <select
          id="responsibleAccountId"
          name="responsibleAccountId"
          defaultValue=""
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone}
            </option>
          ))}
        </select>

        <label htmlFor="visibility" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue="TEAM"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        >
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          등록
        </button>
      </form>

      <h2 style={{ fontSize: 16 }}>등록된 기구</h2>
      {orgUnits.length === 0 ? (
        <p style={{ color: "#555555" }}>등록된 기구가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {orgUnits.map((orgUnit) => (
            <li key={orgUnit.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
              <div>
                <strong>{orgUnit.name}</strong>{" "}
                <span style={{ fontSize: 12, color: "#888888" }}>{orgUnit.displayId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#555555" }}>
                {SUBJECT_STATUS_LABELS[orgUnit.status]}
                {orgUnit.region && ` · ${orgUnit.region}`}
                {orgUnit.expertiseTags.length > 0 && ` · ${orgUnit.expertiseTags.join(", ")}`}
                {orgUnit.responsibleAccountId &&
                  ` · 책임 담당자: ${responsibleLabelById.get(orgUnit.responsibleAccountId) ?? orgUnit.responsibleAccountId}`}
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
                <Link href={`/admin/org-units/${orgUnit.id}/edit`} style={{ fontSize: 13 }}>
                  정보 수정
                </Link>
                <form method="POST" action={`/api/admin/org-units/${orgUnit.id}/archive`}>
                  <button type="submit" style={{ fontSize: 13, padding: "4px 10px" }}>
                    보관하기
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>보관된 기구</h2>
      {archivedOrgUnits.length === 0 ? (
        <p style={{ color: "#555555" }}>보관된 기구가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {archivedOrgUnits.map((orgUnit) => (
            <li key={orgUnit.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
              <div>
                <strong>{orgUnit.name}</strong>{" "}
                <span style={{ fontSize: 12, color: "#888888" }}>{orgUnit.displayId}</span>
              </div>
              <div style={{ fontSize: 12, color: "#555555" }}>
                {orgUnit.region && ` ${orgUnit.region}`}
                {orgUnit.expertiseTags.length > 0 && ` · ${orgUnit.expertiseTags.join(", ")}`}
                {orgUnit.archivedAt && ` · ${orgUnit.archivedAt.toISOString().slice(0, 10)} 보관됨`}
              </div>
              <div style={{ marginTop: 6 }}>
                <form method="POST" action={`/api/admin/org-units/${orgUnit.id}/restore`}>
                  <button type="submit" style={{ fontSize: 13, padding: "4px 10px" }}>
                    복원
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
