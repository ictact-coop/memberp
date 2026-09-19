import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { SUBJECT_STATUS_LABELS } from "@/lib/subject-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "이름을 입력해야 합니다.",
  no_subject: "계정에 연결된 사람 정보가 없어 수정할 수 없습니다.",
  invalid_region: "선택한 지역을 확인할 수 없습니다.",
  invalid_expertise_tag: "선택한 전문영역·관심 중 확인할 수 없는 값이 있습니다.",
};

interface ContactInfo {
  value?: string;
}

interface ContactConsent {
  promotionalOptIn?: boolean;
}

// 내 정보 — FR-03. v0.1 P01의 자기 정보 항목(이름·지역·전문영역/관심·연락처·수신
// 동의) 중, 조직이 관리해야 하는 항목(활동 상태·책임 담당자)을 뺀 나머지를
// 본인이 직접 고친다.
export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { error } = await searchParams;

  const subject = active.account.subjectId
    ? await prisma.subject.findUnique({ where: { id: active.account.subjectId } })
    : null;

  const contactInfo = (subject?.contactInfo as ContactInfo | null) ?? null;
  const contactConsent = (subject?.contactConsent as ContactConsent | null) ?? null;

  const [regionOptions, expertiseOptions] = await Promise.all([
    prisma.classification.findMany({
      where: { domain: "REGION", active: true },
      orderBy: { label: "asc" },
    }),
    prisma.classification.findMany({
      where: { domain: "EXPERTISE", active: true },
      orderBy: { label: "asc" },
    }),
  ]);
  // 분류표에 아직 없는 기존 값(레거시 자유 텍스트)도 잃지 않도록 선택지에 끼워
  // "(목록에 없음)"으로 표시한다 — src/lib/classification-labels.ts 참고.
  const regionLabels = new Set(regionOptions.map((o) => o.label));
  const legacyRegion =
    subject?.region && !regionLabels.has(subject.region) ? subject.region : null;
  const expertiseLabels = new Set(expertiseOptions.map((o) => o.label));
  const legacyExpertiseTags = (subject?.expertiseTags ?? []).filter((tag) => !expertiseLabels.has(tag));

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>FR-03</p>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>내 정보</h1>
      <p style={{ color: "var(--color-text-muted)" }}>로그인 계정: {active.account.email}</p>

      <form method="POST" action="/api/auth/logout" style={{ marginBottom: 24 }}>
        <button type="submit" className="btn-outline" style={{ padding: "10px 16px", fontSize: 16 }}>
          로그아웃
        </button>
      </form>

      <h2 style={{ fontSize: 16 }}>연락처·관심 분야</h2>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}

      {!subject ? (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES.no_subject}</p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            활동 상태: {SUBJECT_STATUS_LABELS[subject.status]}
            {subject.confirmedAt && ` · 최근 확인일: ${subject.confirmedAt.toISOString().slice(0, 10)}`}
          </p>

          <form method="POST" action="/api/profile/update" className="card">
            <label htmlFor="name" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              이름
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={subject.name}
              style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
            />
            {subject.previousNames.length > 0 && (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: -8, marginBottom: 12 }}>
                이전 이름: {subject.previousNames.join(", ")}
              </p>
            )}

            <label htmlFor="region" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              지역
            </label>
            <select
              id="region"
              name="region"
              defaultValue={subject.region ?? ""}
              style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
            >
              <option value="">선택 안 함</option>
              {legacyRegion && (
                <option value={legacyRegion}>{legacyRegion} (목록에 없음)</option>
              )}
              {regionOptions.map((option) => (
                <option key={option.id} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>

            <fieldset style={{ border: "1px solid #e0e0e0", padding: 10, marginBottom: 12 }}>
              <legend style={{ fontSize: 14 }}>전문영역·관심</legend>
              {expertiseOptions.length === 0 && legacyExpertiseTags.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                  등록된 분류가 없습니다.
                </p>
              ) : (
                <>
                  {expertiseOptions.map((option) => (
                    <label key={option.id} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
                      <input
                        type="checkbox"
                        name="expertiseTags"
                        value={option.label}
                        defaultChecked={subject.expertiseTags.includes(option.label)}
                      />{" "}
                      {option.label}
                    </label>
                  ))}
                  {legacyExpertiseTags.map((tag) => (
                    <label key={tag} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
                      <input type="checkbox" name="expertiseTags" value={tag} defaultChecked /> {tag}{" "}
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>(목록에 없음)</span>
                    </label>
                  ))}
                </>
              )}
            </fieldset>

            <label htmlFor="contact" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              연락처 — 다른 조합원에게 공개되지 않습니다
            </label>
            <input
              id="contact"
              name="contact"
              defaultValue={contactInfo?.value ?? ""}
              style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
            />

            <label style={{ display: "block", fontSize: 14, marginBottom: 16 }}>
              <input
                type="checkbox"
                name="promotionalOptIn"
                defaultChecked={contactConsent?.promotionalOptIn ?? false}
              />{" "}
              공지·안내 연락 수신에 동의합니다
            </label>

            <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
              저장
            </button>
          </form>
        </>
      )}
    </section>
  );
}
