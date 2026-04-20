"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/explorer", label: "Explorer", icon: "🔍" },
  { href: "/plays", label: "Plays", icon: "🏗️" },
  { href: "/playground", label: "Playground", icon: "🎮" },
  { href: "/learning", label: "Learning", icon: "🌱" },
  { href: "/ecosystem", label: "Ecosystem", icon: "🌐" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="text-xl">🌿</span>
        <span className="text-lg font-bold tracking-tight">
          <span className="text-white">Froot</span>
          <span className="text-frootai-emerald">AI</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-frootai-emerald/10 text-frootai-emerald"
                : "text-frootai-muted hover:bg-frootai-surface-hover hover:text-frootai-text"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* External links */}
      <div className="border-t border-frootai-border px-3 py-4 space-y-1">
        <a
          href="https://docs.frootai.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-frootai-muted hover:bg-frootai-surface-hover hover:text-frootai-text transition-colors"
        >
          <span className="text-base">📖</span>
          Docs
        </a>
        <a
          href="https://github.com/frootai/frootai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-frootai-muted hover:bg-frootai-surface-hover hover:text-frootai-text transition-colors"
        >
          <span className="text-base">⭐</span>
          GitHub
        </a>
      </div>

      {/* Footer branding */}
      <div className="px-5 py-4 text-[11px] text-frootai-muted">
        <span className="text-white">Froot</span>
        <span className="text-frootai-emerald">AI</span>
        <span className="ml-1">Platform v5.2</span>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-frootai-border bg-frootai-surface px-4 lg:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-frootai-muted hover:bg-frootai-surface-hover hover:text-frootai-text transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            {open ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </>
            )}
          </svg>
        </button>
        <span className="text-sm font-bold tracking-tight">
          <span className="text-white">Froot</span>
          <span className="text-frootai-emerald">AI</span>
        </span>
        <a
          href="https://github.com/frootai/frootai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-frootai-muted hover:text-frootai-text text-sm"
        >
          ⭐
        </a>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-frootai-surface">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-frootai-border bg-frootai-surface lg:flex">
        {navContent}
      </aside>
    </>
  );
}
