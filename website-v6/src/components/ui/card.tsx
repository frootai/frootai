import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: string; // CSS color for hover glow
}

export function Card({ className, glow, children, style, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg-surface p-5",
        "transition-all duration-300",
        "hover:border-indigo/20 hover:bg-bg-elevated",
        "hover:shadow-[0_0_16px_rgba(99,102,241,0.08),0_4px_20px_rgba(0,0,0,0.2)]",
        "hover:-translate-y-0.5",
        className
      )}
      style={glow ? { "--glow": glow, ...style } as React.CSSProperties : style}
      {...props}
    >
      {children}
    </div>
  );
}
