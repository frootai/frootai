"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, Sparkles, Settings, Target, Package, Link2, Monitor, Plug, Zap, Container, ClipboardList, Handshake, Store, Leaf, BarChart3, BookOpen, FileText, Languages, ClipboardCheck, Wrench, ListChecks, Radio, Activity, Newspaper, Hand, type LucideIcon } from "lucide-react";
import { SearchFAI } from "@/components/layout/search-fai";

const menus = [
  { label: "FAI Platform", items: [
    { href: "/configurator", label: "Solution Configurator", Icon: Settings },
    { href: "/solution-plays", label: "Solution Plays (20)", Icon: Target },
    { href: "/packages", label: "Packages", Icon: Package },
  ]},
  { label: "FAI Solutions", items: [
    { href: "/ecosystem", label: "Ecosystem Overview", Icon: Link2 },
    { href: "/vscode-extension", label: "VS Code Extension", Icon: Monitor },
    { href: "/mcp-tooling", label: "MCP Server (22 tools)", Icon: Plug },
    { href: "/cli", label: "CLI (npx frootai)", Icon: Zap },
    { href: "/docker", label: "Docker Image", Icon: Container },
    { href: "/setup-guide", label: "Setup Guide", Icon: ClipboardList },
  ]},
  { label: "FAI Community", items: [
    { href: "/partners", label: "Partner Integrations", Icon: Handshake },
    { href: "/marketplace", label: "Plugin Marketplace", Icon: Store },
    { href: "/community", label: "Open Source Community", Icon: Leaf },
    { href: "/adoption", label: "FrootAI Adoption", Icon: BarChart3 },
  ]},
  { label: "FAI Learning", items: [
    { href: "/learning-hub", label: "FAI Learning Center", Icon: BookOpen },
    { href: "/docs", label: "Knowledge Modules (18)", Icon: FileText },
    { href: "/docs/F3-AI-Glossary-AZ", label: "AI Glossary (200+)", Icon: Languages },
    { href: "/docs/Quiz-Assessment", label: "Quiz & Assessment", Icon: ClipboardCheck },
  ]},
  { label: "FAI Dev Hub", items: [
    { href: "/dev-hub", label: "Developer Center", Icon: Wrench },
    { href: "/feature-spec", label: "Feature Spec", Icon: ListChecks },
    { href: "/api-docs", label: "REST API", Icon: Radio },
    { href: "/eval-dashboard", label: "Eval Dashboard", Icon: Activity },
    { href: "/dev-hub-changelog", label: "Changelog", Icon: Newspaper },
  ]},
];

function DesktopDropdown({ label, items }: { label: string; items: { href: string; label: string; Icon: LucideIcon }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="nav-item-hover flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] text-fg-muted whitespace-nowrap transition-all duration-200 cursor-pointer">
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 min-w-[240px] rounded-xl border border-border bg-bg-surface/95 backdrop-blur-2xl p-1.5 shadow-2xl shadow-black/30"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item-hover flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] text-fg-muted transition-all duration-200"
              >
                <item.Icon className="nav-icon h-4 w-4 shrink-0 text-fg-dim transition-colors duration-200" />
                {item.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg/80 backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 font-bold text-[1.1rem] tracking-tight shrink-0">
          <img src="/img/frootai-mark.svg" alt="" width={34} height={34} className="shrink-0" />
          <span>Froot<span className="text-emerald">AI</span></span>
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-0">
          {menus.map((m) => <DesktopDropdown key={m.label} {...m} />)}
        </div>

        {/* Right links */}
        <div className="hidden lg:flex items-center gap-1">
          <Link href="/hi-fai" className="nav-accent-emerald flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-emerald whitespace-nowrap transition-all duration-200">
            <Hand className="h-4 w-4" /> Hi FAI
          </Link>
          <Link href="/chatbot" className="nav-accent-amber flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-amber whitespace-nowrap transition-all duration-200">
            <Sparkles className="h-4 w-4" /> Agent FAI
          </Link>
          <SearchFAI />
          <a href="https://github.com/gitpavleenbali/frootai" target="_blank" rel="noopener noreferrer"
            className="nav-item-hover ml-1 px-3 py-1.5 rounded-lg text-[13px] text-fg-muted whitespace-nowrap transition-all duration-200">
            GitHub
          </a>
        </div>

        {/* Mobile toggle */}
        <button className="lg:hidden p-2 text-fg-muted hover:text-fg cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border-subtle bg-bg/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="max-h-[75vh] overflow-y-auto p-4 space-y-4">
              {menus.map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-dim mb-1.5 px-1">{m.label}</p>
                  <div className="space-y-0.5">
                    {m.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                        className="nav-item-hover flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-fg-muted transition-all duration-200">
                        <item.Icon className="nav-icon h-4 w-4 shrink-0 text-fg-dim transition-colors duration-200" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-border-subtle space-y-1">
                <Link href="/hi-fai" onClick={() => setMobileOpen(false)}
                  className="nav-accent-emerald flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-emerald transition-all duration-200"><Hand className="h-4 w-4" /> Hi FAI</Link>
                <Link href="/chatbot" onClick={() => setMobileOpen(false)}
                  className="nav-accent-amber flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-amber transition-all duration-200"><Sparkles className="h-4 w-4" /> Agent FAI</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
