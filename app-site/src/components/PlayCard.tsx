import type { Play } from "@/lib/api";
import { formatPlayName, getPlayCategory, getPlayComplexity } from "@/lib/api";

const complexityColors = {
  Low: "bg-green-500/20 text-green-300",
  Medium: "bg-yellow-500/20 text-yellow-300",
  High: "bg-red-500/20 text-red-300",
};

interface PlayCardProps {
  play: Play;
  onClick?: () => void;
}

export default function PlayCard({ play, onClick }: PlayCardProps) {
  const displayName = formatPlayName(play.slug);
  const category = getPlayCategory(play.slug);
  const complexity = getPlayComplexity(play);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-frootai-border bg-frootai-surface p-5 text-left hover:border-frootai-emerald/50 hover:bg-frootai-surface-hover transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-frootai-emerald/10 text-sm font-bold text-frootai-emerald">
            {play.id.padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-frootai-text truncate">
              {displayName}
            </h3>
            <span className="text-[11px] text-frootai-muted">{category}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${complexityColors[complexity]}`}
        >
          {complexity}
        </span>
      </div>
      <p className="mt-3 text-xs text-frootai-muted line-clamp-2 leading-relaxed">
        {play.description}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {play.speckit?.waf?.slice(0, 3).map((w) => (
            <span
              key={w}
              className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-frootai-muted"
            >
              {w.replace(/-/g, " ")}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-frootai-muted">
          {play.hasManifest && (
            <span className="text-frootai-emerald" title="Has FAI manifest">
              ●
            </span>
          )}
          <span>{play.devkit?.agents ?? 0}A</span>
          <span>{play.devkit?.skills ?? 0}S</span>
        </div>
      </div>
    </button>
  );
}
