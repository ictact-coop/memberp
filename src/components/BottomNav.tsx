"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// v0.2 §2.1 모바일 기본 메뉴: 홈 / 참여할 일 / 기록하기 / 우리 조합 / 내 정보
const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/activities", label: "참여할 일" },
  { href: "/my/contributions/new", label: "기록하기" },
  { href: "/needs", label: "우리 조합" },
  { href: "/my/profile", label: "내 정보" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        background: "var(--color-primary)",
        boxShadow: "0 -1px 0 rgba(0,0,0,0.08)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "10px 4px 12px",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: active ? 700 : 500,
              color: active ? "var(--color-accent)" : "rgba(255,255,255,0.65)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
