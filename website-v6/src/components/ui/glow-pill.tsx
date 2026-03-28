import Link from "next/link";
import { cn } from "@/lib/utils";

interface GlowPillProps {
  href: string;
  color: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}

/**
 * GlowPill — a pill-shaped link with a colored glow on hover.
 * Matches the production site's CTA pill style exactly.
 * Uses Tailwind classes only — no inline styles.
 */
export function GlowPill({ href, color, children, className, external }: GlowPillProps) {
  const classes = cn(
    "glow-card inline-flex items-center gap-1 !rounded-full",
    "px-4 py-2 text-[12px] font-semibold",
    "active:scale-[0.97]",
    className
  );

  // Dynamic styles for the brand color
  const dynamicStyle = {
    color,
    borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
    background: `color-mix(in srgb, ${color} 4%, transparent)`,
  } as React.CSSProperties;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} style={dynamicStyle}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} style={dynamicStyle}>
      {children}
    </Link>
  );
}
