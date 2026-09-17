import { Resend } from "resend";

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ADR-0003: Resend가 R1 이메일 발송 공급자다. API 키가 없는 로컬 개발 환경에서는
// 실제로 보내지 않고 콘솔에 링크를 출력한다 — Resend 계정 없이도 로그인 흐름을
// 끝까지 확인할 수 있게 하기 위함이다.
export async function sendLoginEmail(to: string, verifyUrl: string): Promise<void> {
  if (!resendClient) {
    console.log(`[dev-email] 로그인 링크 (${to}): ${verifyUrl}`);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM 환경변수가 설정되지 않았습니다.");
  }

  await resendClient.emails.send({
    from,
    to,
    subject: "[공동체IT] 로그인 링크",
    html: `<p>아래 링크를 눌러 로그인하세요. 15분 동안만 유효합니다.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>`,
  });
}

export async function sendInvitationEmail(to: string, acceptUrl: string): Promise<void> {
  if (!resendClient) {
    console.log(`[dev-email] 초대 링크 (${to}): ${acceptUrl}`);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM 환경변수가 설정되지 않았습니다.");
  }

  await resendClient.emails.send({
    from,
    to,
    subject: "[공동체IT] 가입 초대",
    html: `<p>공동체IT 관리시스템에 초대되었습니다. 아래 링크를 눌러 가입을 완료하세요.</p><p><a href="${acceptUrl}">${acceptUrl}</a></p>`,
  });
}
