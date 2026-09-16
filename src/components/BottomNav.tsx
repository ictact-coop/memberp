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
        borderTop: "1px solid #e0e0e0",
        background: "#ffffff",
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
              padding: "12px 4px",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: active ? 700 : 400,
              color: active ? "#1a1a1a" : "#888888",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
