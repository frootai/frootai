import type { Primitive } from "@/lib/api";

const typeColors: Record<string, string> = {
  agent: "bg-violet-500/20 text-violet-300",
  skill: "bg-blue-500/20 text-blue-300",
  instruction: "bg-amber-500/20 text-amber-300",
  hook: "bg-rose-500/20 text-rose-300",
  plugin: "bg-cyan-500/20 text-cyan-300",
  workflow: "bg-green-500/20 text-green-300",
};

const wafColors: Record<string, string> = {
  security: "bg-red-500/10 text-red-400",
  reliability: "bg-blue-500/10 text-blue-400",
  "cost-optimization": "bg-yellow-500/10 text-yellow-400",
  "performance-efficiency": "bg-green-500/10 text-green-400",
  "operational-excellence": "bg-purple-500/10 text-purple-400",
  "responsible-ai": "bg-pink-500/10 text-pink-400",
};

interface PrimitiveCardProps {
  primitive: Primitive;
  onClick?: () => void;
}

export default function PrimitiveCard({
  primitive,
  onClick,
}: PrimitiveCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-frootai-border bg-frootai-surface p-4 text-left hover:border-frootai-emerald/50 hover:bg-frootai-surface-hover transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-frootai-text leading-tight truncate flex-1">
          {primitive.name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeColors[primitive.type] ?? "bg-gray-500/20 text-gray-300"}`}
        >
          {primitive.type}
        </span>
      </div>
      <p className="mt-2 text-xs text-frootai-muted line-clamp-2 leading-relaxed">
        {primitive.description}
      </p>
      {primitive.waf.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {primitive.waf.slice(0, 3).map((w) => (
            <span
              key={w}
              className={`rounded px-1.5 py-0.5 text-[10px] ${wafColors[w] ?? "bg-gray-500/10 text-gray-400"}`}
            >
              {w.replace(/-/g, " ")}
            </span>
          ))}
          {primitive.waf.length > 3 && (
            <span className="rounded px-1.5 py-0.5 text-[10px] bg-gray-500/10 text-gray-400">
              +{primitive.waf.length - 3}
            </span>
          )}
        </div>
      )}
      {primitive.plays.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {primitive.plays.slice(0, 2).map((p) => (
            <span
              key={p}
              className="rounded bg-frootai-emerald/10 px-1.5 py-0.5 text-[10px] text-frootai-emerald"
            >
              {p}
            </span>
          ))}
          {primitive.plays.length > 2 && (
            <span className="rounded bg-frootai-emerald/10 px-1.5 py-0.5 text-[10px] text-frootai-emerald">
              +{primitive.plays.length - 2}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
