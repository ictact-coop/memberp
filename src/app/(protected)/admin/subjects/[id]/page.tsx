import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { SUBJECT_STATUS_LABELS, SUBJECT_TYPE_LABELS } from "@/lib/subject-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "상대 주체와 관계 유형을 모두 선택하세요.",
  same_subject: "같은 주체와는 관계를 맺을 수 없습니다.",
  invalid_subject: "선택한 상대 주체를 확인할 수 없습니다(보관됨 등).",
  invalid_type: "선택한 관계 유형을 확인할 수 없습니다.",
  invalid_dates: "종료일은 시작일보다 빠를 수 없습니다.",
  archived: "보관된 주체에는 관계를 추가할 수 없습니다.",
};

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

// 사람·단체 상세 — v1.0 §6 "사람·단체 상세: 관계, 참여 이력, 관련 수요·활동·결과"
// 화면 요구사항 중 "관계"(FR-13, R2) 부분을 먼저 채운다. 참여 이력·관련
// 수요·활동·결과는 이후 작업(WP-05의 남은 조각, "업무"·"회의·결정")과 함께
// 넓힐 자리로 남겨둔다 — 지금은 사람·단체 자체 정보와 관계만 다룬다.
export default async function SubjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { id } = await params;
  const { error } = await searchParams;

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { account: { select: { email: true, phone: true } } },
  });
  if (!subject) {
    notFound();
  }

  const [relationshipsFrom, relationshipsTo, relationshipTypes, otherSubjects] = await Promise.all([
    prisma.relationship.findMany({
      where: { fromSubjectId: id },
      include: { toSubject: true, classification: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.relationship.findMany({
      where: { toSubjectId: id },
      include: { fromSubject: true, classification: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.classification.findMany({
      where: { domain: "RELATIONSHIP_TYPE", active: true },
      orderBy: { label: "asc" },
    }),
    prisma.subject.findMany({
      where: { id: { not: id }, archivedAt: null },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, displayId: true, name: true, type: true },
    }),
  ]);

  const listBackHref = subject.type === "PERSON" ? "/admin/subjects" : "/admin/org-units";

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        <Link href={listBackHref}>목록으로</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>
        {subject.name}
        {subject.archivedAt && " (보관됨)"}
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        {subject.displayId} · {SUBJECT_TYPE_LABELS[subject.type]} ·{" "}
        {SUBJECT_STATUS_LABELS[subject.status]}
        {subject.region && ` · ${subject.region}`}
        {" · 로그인 계정: "}
        {subject.account ? subject.account.email ?? subject.account.phone ?? "있음" : "없음"}
      </p>

      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <h2 style={{ fontSize: 16 }}>관계</h2>
      {relationshipsFrom.length === 0 && relationshipsTo.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>등록된 관계가 없습니다.</p>
      ) : (
        <ul className="card-list">
          {relationshipsFrom.map((rel) => (
            <li key={rel.id} className="card">
              <div style={{ fontSize: 13 }}>
                <strong>{rel.classification.label}</strong> →{" "}
                <Link href={`/admin/subjects/${rel.toSubject.id}`}>
                  {rel.toSubject.displayId} · {rel.toSubject.name}
                </Link>
                {rel.role && ` (${rel.role})`}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {formatDate(rel.startDate)} ~ {rel.endDate ? formatDate(rel.endDate) : "진행 중"}
                {rel.note && ` · ${rel.note}`}
              </div>
              {!rel.endDate && (
                <form method="POST" action={`/api/admin/relationships/${rel.id}/end`} style={{ marginTop: 4 }}>
                  <button type="submit" style={{ fontSize: 12, padding: "2px 8px" }}>
                    종료
                  </button>
                </form>
              )}
            </li>
          ))}
          {relationshipsTo.map((rel) => (
            <li key={rel.id} className="card">
              <div style={{ fontSize: 13 }}>
                <Link href={`/admin/subjects/${rel.fromSubject.id}`}>
                  {rel.fromSubject.displayId} · {rel.fromSubject.name}
                </Link>{" "}
                → <strong>{rel.classification.label}</strong>
                {rel.role && ` (${rel.role})`}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {formatDate(rel.startDate)} ~ {rel.endDate ? formatDate(rel.endDate) : "진행 중"}
                {rel.note && ` · ${rel.note}`}
                {" · 상대쪽에서 등록"}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!subject.archivedAt && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24 }}>관계 추가</h2>
          <form
            method="POST"
            action={`/api/admin/subjects/${id}/relationships/create`}
            className="card"
          >
            <label htmlFor="toSubjectId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              상대 사람·단체
            </label>
            <select
              id="toSubjectId"
              name="toSubjectId"
              required
              style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
            >
              <option value="">선택하세요</option>
              {otherSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayId} · {s.name} ({SUBJECT_TYPE_LABELS[s.type]})
                </option>
              ))}
            </select>

            <label htmlFor="classificationId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              관계 유형
            </label>
            <select
              id="classificationId"
              name="classificationId"
              required
              style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
            >
              <option value="">선택하세요</option>
              {relationshipTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            {relationshipTypes.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                등록된 관계 유형이 없습니다. <Link href="/admin/classifications">분류 관리</Link>에서
                "관계 유형"을 먼저 등록하세요.
              </p>
            )}

            <label htmlFor="role" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              역할(선택)
            </label>
            <input
              id="role"
              name="role"
              placeholder="예: 이사, 자문위원"
              style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
            />

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="startDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                  시작일
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={formatDate(new Date())}
                  style={{ width: "100%", padding: 10, fontSize: 16 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="endDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                  종료일(선택)
                </label>
                <input id="endDate" name="endDate" type="date" style={{ width: "100%", padding: 10, fontSize: 16 }} />
              </div>
            </div>

            <label htmlFor="note" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              메모(선택)
            </label>
            <input id="note" name="note" style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }} />

            <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
              관계 등록
            </button>
          </form>
        </>
      )}
    </section>
  );
}
