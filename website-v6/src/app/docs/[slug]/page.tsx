import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { GlowPill } from "@/components/ui/glow-pill";
import { DocContent } from "./doc-content";
import { DocTableOfContents } from "@/components/ui/doc-toc";
import { InPageToc } from "@/components/ui/in-page-toc";

const docsDir = path.join(process.cwd(), "..", "docs");

const allSlugs = [
  "admin-guide", "AI-Agents-Deep-Dive", "AI-Infrastructure", "api-reference",
  "architecture-overview", "Azure-AI-Foundry", "contributor-guide", "Copilot-Ecosystem",
  "F3-AI-Glossary-AZ", "F4-GitHub-Agentic-OS", "GenAI-Foundations", "LLM-Landscape",
  "O3-MCP-Tools-Functions", "Prompt-Engineering", "Quick-Reference-Cards", "Quiz-Assessment",
  "R3-Deterministic-AI", "RAG-Architecture", "README", "Responsible-AI-Safety",
  "Semantic-Kernel", "T1-Fine-Tuning-MLOps", "T3-Production-Patterns", "user-guide-complete",
];

export async function generateStaticParams() {
  return allSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { title, description: `FrootAI knowledge module: ${title}` };
}

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const filePath = path.join(docsDir, `${slug}.md`);

  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    content = `# ${slug}\n\nThis document is not yet available. Check [GitHub](https://github.com/gitpavleenbali/frootai/tree/main/docs) for the latest version.`;
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-4xl xl:max-w-5xl px-4 lg:px-6 xl:pr-64 py-12 sm:py-16 overflow-x-hidden">
      <div className="mb-4">
        <Link href="/docs" className="text-[12px] text-amber hover:underline font-medium">← Back to Knowledge Modules</Link>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight mb-4">{title}</h1>

      <InPageToc />

      <DocContent content={content} />

      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/docs" color="#f97316">All Modules</GlowPill>
        <GlowPill href={`https://github.com/gitpavleenbali/frootai/blob/main/docs/${slug}.md`} color="#6366f1" external>Edit on GitHub</GlowPill>
        <GlowPill href="/" color="#10b981">FrootAI</GlowPill>
      </div>

      {/* TOC: fixed on desktop, floating button on mobile */}
      <DocTableOfContents />
    </div>
  );
}
