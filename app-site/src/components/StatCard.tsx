interface StatCardProps {
  icon: string;
  title: string;
  value: number | string;
  trend?: string;
}

export default function StatCard({ icon, title, value, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5 hover:border-frootai-emerald/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className="text-xs font-medium text-frootai-emerald">
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-frootai-text">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-sm text-frootai-muted">{title}</p>
    </div>
  );
}
