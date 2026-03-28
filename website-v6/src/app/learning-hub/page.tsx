import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Languages, GraduationCap, ClipboardCheck, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = {
  title: "FAI Learning Hub",
  description: "Learn AI architecture from the roots up. 18 modules, 200+ terms, workshops, quiz, certification.",
};

const paths: { href: string; Icon: LucideIcon; title: string; sub: string; color: string; external?: boolean }[] = [
  { href: "/docs", Icon: BookOpen, title: "18 Knowledge Modules", sub: "From tokens to production agents", color: "#f59e0b" },
  { href: "/docs/F3-AI-Glossary-AZ", Icon: Languages, title: "200+ AI Terms", sub: "Comprehensive glossary A-Z", color: "#10b981" },
  { href: "https://github.com/gitpavleenbali/frootai/tree/main/workshops", Icon: GraduationCap, title: "Workshop Materials", sub: "4 hands-on workshops", color: "#6366f1", external: true },
  { href: "/docs/Quiz-Assessment", Icon: ClipboardCheck, title: "Quiz & Assessment", sub: "25 questions to test yourself", color: "#06b6d4" },
];

export default function LearningHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="FAI Learning Hub"
        subtitle="Learn AI architecture from the roots up. Modules, glossary, workshops, and quizzes — all free."
      />

      {/* 4 path cards */}
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
        {paths.map((p) => (
          <StaggerItem key={p.title}>
            {p.external ? (
              <a href={p.href} target="_blank" rel="noopener noreferrer"
                className="glow-card group block p-5 text-center h-full" style={{ "--glow": p.color } as React.CSSProperties}>
                <div className="flex justify-center mb-2 transition-transform duration-200 group-hover:scale-110"><p.Icon className="h-6 w-6" style={{ color: p.color }} /></div>
                <div className="font-bold text-[14px] text-fg">{p.title}</div>
                <div className="text-[12px] mt-1" style={{ color: p.color }}>{p.sub}</div>
              </a>
            ) : (
              <Link href={p.href}
                className="glow-card group block p-5 text-center h-full" style={{ "--glow": p.color } as React.CSSProperties}>
                <div className="flex justify-center mb-2 transition-transform duration-200 group-hover:scale-110"><p.Icon className="h-6 w-6" style={{ color: p.color }} /></div>
                <div className="font-bold text-[14px] text-fg">{p.title}</div>
                <div className="text-[12px] mt-1" style={{ color: p.color }}>{p.sub}</div>
              </Link>
            )}
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Coming Soon: Certification */}
      <FadeIn>
        <div className="rounded-2xl border-2 border-dashed border-violet/25 bg-violet/[0.02] p-8 text-center mb-14">
          <div className="inline-block rounded-full border border-violet/30 bg-violet/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet mb-4">
            Coming Soon
          </div>
          <h3 className="text-lg font-bold mb-2">FrootAI Certified Professional</h3>
          <p className="text-[13px] text-fg-muted max-w-md mx-auto">
            Study → Lab → Exam → Badge. Validate your AI architecture skills. We are building the certification program and will launch it when the community is ready.
          </p>
        </div>
      </FadeIn>

      {/* Explore More */}
      <FadeIn delay={0.1}>
        <div className="rounded-2xl border-2 border-amber/20 bg-amber/[0.02] p-8 text-center">
          <h2 className="text-lg font-bold mb-5">Explore More</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <GlowPill href="/community" color="#00c853">Open Source Community →</GlowPill>
            <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem Overview →</GlowPill>
            <GlowPill href="/dev-hub" color="#7c3aed">Developer Center →</GlowPill>
            <GlowPill href="/" color="#f59e0b">Back to FrootAI →</GlowPill>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
