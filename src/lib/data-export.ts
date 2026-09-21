// 데이터 내보내기 공통 — 관리자 전체 백업(/admin/backup)과 본인 데이터 내보내기
// (/my/profile)가 같은 파일 형식(JSON, 타임스탬프 파일명)을 쓰도록 모은다.
// 병행운영전략 v0.2 §"v0.1 참여 시범" 범위에 "내보내기·백업"이 명시되어 있다.
export function buildExportResponse(payload: unknown, filenamePrefix: string): Response {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const body = JSON.stringify(payload, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenamePrefix}-${timestamp}.json"`,
    },
  });
}
