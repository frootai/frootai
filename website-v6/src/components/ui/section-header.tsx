import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  badge?: string;
  badgeColor?: string;
  title: string;
  subtitle?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ badge, badgeColor = "#10b981", title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn("text-center mb-10", className)}>
      {badge && (
        <div
          className="inline-block rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest mb-4 border"
          style={{
            color: badgeColor,
            borderColor: `color-mix(in srgb, ${badgeColor} 30%, transparent)`,
            background: `color-mix(in srgb, ${badgeColor} 6%, transparent)`,
          }}
        >
          {badge}
        </div>
      )}
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      {subtitle && (
        <p className="mt-3 text-sm text-fg-muted max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
