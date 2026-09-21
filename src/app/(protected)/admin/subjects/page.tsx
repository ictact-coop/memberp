import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { SUBJECT_STATUS_LABELS } from "@/lib/subject-labels";

// 사람 목록 — 동명이인·중복 등록을 찾아 병합하러 오는 진입점("아직 없는 것"의
// "사람 주체 동명이인·중복 정리"). 이름으로 검색해 같은 이름(또는 비슷한
// 이름)이 여러 건인지 눈으로 먼저 확인할 수 있게 한다. 등록·병합은 각각
// 별도 화면(/admin/subjects/new, /admin/subjects/merge)으로 링크만 건다.
export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { q } = await searchParams;
  const query = q?.trim();

  const subjects = await prisma.subject.findMany({
    where: {
      type: "PERSON",
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    include: { account: { select: { email: true, phone: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        <Link href="/admin">관리자 설정</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>사람 목록</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        조합에 등록된 사람 주체(Subject)입니다. 같은 사람이 두 건으로 나뉘어 있으면
        "동명이인 병합"에서 하나로 합칠 수 있습니다.
      </p>

      <p style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link href="/admin/subjects/new" style={{ fontSize: 13, fontWeight: 600 }}>
          사람 미리 등록 →
        </Link>
        <Link href="/admin/subjects/merge" style={{ fontSize: 13, fontWeight: 600 }}>
          동명이인 병합 →
        </Link>
      </p>

      <form method="GET" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="이름으로 검색"
          style={{ padding: 8, fontSize: 14, flex: 1 }}
        />
        <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
          검색
        </button>
      </form>

      {subjects.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          조건에 맞는 사람이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {subjects.map((subject) => (
            <li key={subject.id} className="card">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {subject.displayId}
                {subject.archivedAt && " · 보관됨(병합으로 사라짐)"}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>{subject.name}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {SUBJECT_STATUS_LABELS[subject.status]}
                {subject.region && ` · ${subject.region}`}
                {" · 로그인 계정: "}
                {subject.account ? subject.account.email ?? subject.account.phone ?? "있음" : "없음"}
              </div>
              {subject.previousNames.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  이전 이름: {subject.previousNames.join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
