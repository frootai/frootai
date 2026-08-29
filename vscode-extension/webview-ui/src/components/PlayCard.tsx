import type { SolutionPlay } from "../types";

const LAYER_COLORS: Record<string, string> = {
  F: "#f59e0b",
  R: "#10b981",
  O: "#06b6d4",
  T: "#7c3aed",
};

interface PlayCardProps {
  play: SolutionPlay;
  selected?: boolean;
  onClick?: () => void;
}

export default function PlayCard({ play, selected, onClick }: PlayCardProps) {
  const color = LAYER_COLORS[play.layer] ?? "#6b7280";
  return (
    <div
      className={`card card-clickable`}
      onClick={onClick}
      style={{
        borderColor: selected ? color : undefined,
        borderWidth: selected ? 2 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 20 }}>{play.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{play.id} — {play.name}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{play.layer} Layer • {play.dir}</div>
        </div>
      </div>
    </div>
  );
}
