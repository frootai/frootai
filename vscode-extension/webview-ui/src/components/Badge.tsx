interface BadgeProps {
  label: string;
  color: string;
}

export default function Badge({ label, color }: BadgeProps) {
  return <span className="badge" style={{ background: color }}>{label}</span>;
}
