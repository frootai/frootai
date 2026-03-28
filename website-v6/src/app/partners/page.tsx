import type { Metadata } from "next";
import { Ticket, Cloud, Factory, BarChart3, AlertTriangle, ClipboardList, Settings, Plug, Lightbulb, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Partner Integrations", description: "MCP-powered partner integrations for ServiceNow, Salesforce, SAP, Datadog, PagerDuty, and Jira." };

const partners: { name: string; category: string; Icon: LucideIcon; color: string; desc: string; capabilities: string[] }[] = [
  { name: "ServiceNow", category: "ITSM", Icon: Ticket, color: "#7c3aed", desc: "Incident & change management via MCP — auto-create tickets, escalate P1s, and sync resolution notes back into your AI workflow.", capabilities: ["Create / update incidents", "Change request automation", "CMDB lookup", "SLA tracking"] },
  { name: "Salesforce", category: "CRM", Icon: Cloud, color: "#06b6d4", desc: "Customer data + case management piped into your agent context so every answer is customer-aware.", capabilities: ["Account & contact lookup", "Case creation / routing", "Opportunity insights", "Knowledge article search"] },
  { name: "SAP", category: "ERP", Icon: Factory, color: "#10b981", desc: "Business process automation — let your AI agent read purchase orders, trigger workflows, and surface financial data.", capabilities: ["Purchase order lookup", "Invoice processing", "Material master data", "Workflow triggers"] },
  { name: "Datadog", category: "Monitoring", Icon: BarChart3, color: "#f59e0b", desc: "AI workload observability — pull metrics, traces, and alerts into agent context for smarter incident triage.", capabilities: ["Metric queries", "APM trace lookup", "Alert status", "Dashboard snapshots"] },
  { name: "PagerDuty", category: "Incident", Icon: AlertTriangle, color: "#ef4444", desc: "On-call + incident response — your AI agent can check who's on-call, trigger pages, and post updates.", capabilities: ["On-call schedule lookup", "Incident creation", "Escalation triggers", "Status page updates"] },
  { name: "Jira", category: "Project", Icon: ClipboardList, color: "#6366f1", desc: "Issue tracking & sprint management — let agents create stories, log bugs, and check sprint velocity.", capabilities: ["Issue create / update", "Sprint board queries", "Backlog grooming", "Velocity reports"] },
];

const howItWorks = [
  { step: "1", label: "Agent invokes tool", detail: "e.g. servicenow_create_incident" },
  { step: "2", label: "MCP routes request", detail: "Auth via Managed Identity / OAuth" },
  { step: "3", label: "Partner API responds", detail: "Structured JSON back to agent" },
  { step: "4", label: "Agent reasons & acts", detail: "Uses result in next step" },
];

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader title="Partner Integrations" subtitle="Connect FrootAI to your enterprise stack via MCP. Each integration ships as a thin adapter — your AI agent calls it like any other tool." />

      {/* How it works */}
      <FadeIn>
        <div className="rounded-2xl border border-indigo/20 bg-indigo/[0.02] p-6 mb-12">
          <h2 className="flex items-center gap-2 font-bold text-sm mb-4"><Settings className="h-4 w-4 text-indigo" /> How Partner MCP Works</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {howItWorks.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-2xl font-extrabold text-violet">{s.step}</div>
                <div className="text-[13px] font-bold mt-1">{s.label}</div>
                <div className="text-[11px] text-fg-dim mt-0.5">{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Partner cards */}
      <FadeIn delay={0.05}>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-5"><Plug className="h-5 w-5 text-emerald" /> Available Integrations</h2>
      </FadeIn>
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {partners.map((p) => (
          <StaggerItem key={p.name}>
            <div className="relative rounded-2xl border-2 p-6 h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
              style={{ borderColor: `color-mix(in srgb, ${p.color} 25%, transparent)`, background: `color-mix(in srgb, ${p.color} 3%, transparent)` }}>
              <Badge label="Coming Soon" color={p.color} className="absolute top-4 right-4" />
              <div className="mb-2"><p.Icon className="h-8 w-8" style={{ color: p.color }} /></div>
              <h3 className="text-base font-extrabold mb-0.5">{p.name}</h3>
              <p className="text-[11px] font-semibold mb-3" style={{ color: p.color }}>{p.category}</p>
              <p className="text-[13px] text-fg-muted leading-relaxed mb-3">{p.desc}</p>
              <ul className="text-[12px] text-fg-muted space-y-1 list-disc pl-4">
                {p.capabilities.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Propose */}
      <FadeIn delay={0.1}>
        <div className="rounded-2xl border-2 border-violet/20 bg-violet/[0.02] p-8 text-center">
          <h2 className="flex items-center justify-center gap-2 text-xl font-bold mb-2"><Lightbulb className="h-5 w-5 text-violet" /> Want Your Platform Here?</h2>
          <p className="text-[13px] text-fg-muted max-w-md mx-auto mb-5">We welcome community-driven partner integrations. Open an issue to propose a new MCP adapter.</p>
          <GlowPill href="https://github.com/gitpavleenbali/frootai/issues/new" color="#7c3aed" external>Propose a Partner Integration →</GlowPill>
        </div>
      </FadeIn>

      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem</GlowPill>
        <GlowPill href="/marketplace" color="#ec4899">Marketplace</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
