import { useId, useMemo } from "react";

type DiagramNode = { id: string; label: string; group: string };
type DiagramEdge = { from: string; to: string; label: string };
type DiagramModel = { groups: Array<{ id: string; label: string }>; nodes: DiagramNode[]; edges: DiagramEdge[] };

export default function MermaidDiagram({ chart, provenance = "canonical" }: { chart: string; provenance?: "canonical" | "generated" }) {
  const markerId = `fai-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const model = useMemo(() => parseFlowchart(chart), [chart]);
  if (!model.nodes.length) return <div className="fai-mermaid-error" role="alert"><strong>Diagram render error</strong><span>The canonical Mermaid block does not contain a supported flowchart.</span></div>;
  const lanes = model.groups.filter((group) => model.nodes.some((node) => node.group === group.id));
  const width = 960;
  const laneHeight = 174;
  const height = Math.max(220, lanes.length * laneHeight + 30);
  const positions = new Map<string, { x: number; y: number; width: number }>();
  lanes.forEach((lane, laneIndex) => {
    const nodes = model.nodes.filter((node) => node.group === lane.id);
    const available = width - 80;
    const nodeWidth = Math.min(220, Math.max(132, (available - Math.max(0, nodes.length - 1) * 18) / Math.max(1, nodes.length)));
    const gap = nodes.length > 1 ? (available - nodeWidth * nodes.length) / (nodes.length - 1) : 0;
    nodes.forEach((node, nodeIndex) => positions.set(node.id, { x: 40 + nodeIndex * (nodeWidth + gap), y: 48 + laneIndex * laneHeight, width: nodeWidth }));
  });
  return <figure className="fai-mermaid-diagram" aria-label="Rendered solution architecture"><div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Solution architecture diagram" preserveAspectRatio="xMidYMid meet">
    <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
    {lanes.map((lane, index) => <g key={lane.id} className="fai-svg-lane"><rect x="16" y={14 + index * laneHeight} width={width - 32} height={laneHeight - 14} rx="12" /><text x="32" y={36 + index * laneHeight}>{lane.label}</text></g>)}
    {model.edges.map((edge, index) => {
      const from = positions.get(edge.from); const to = positions.get(edge.to);
      if (!from || !to) return null;
      const x1 = from.x + from.width / 2; const y1 = from.y + 72; const x2 = to.x + to.width / 2; const y2 = to.y;
      const sameLane = Math.abs(y2 - y1) < 100;
      const path = sameLane ? `M ${from.x + from.width} ${from.y + 36} L ${to.x - 8} ${to.y + 36}` : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2 - 8}`;
      return <g key={`${edge.from}-${edge.to}-${index}`} className="fai-svg-edge"><path d={path} markerEnd={`url(#${markerId})`} />{edge.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5}>{edge.label}</text>}</g>;
    })}
    {model.nodes.map((node) => { const position = positions.get(node.id); if (!position) return null; const lines = labelLines(node.label); return <g key={node.id} className="fai-svg-node"><rect x={position.x} y={position.y} width={position.width} height="72" rx="9" /><text x={position.x + position.width / 2} y={position.y + 28}>{lines.map((line, index) => <tspan key={index} x={position.x + position.width / 2} dy={index ? 17 : 0}>{line}</tspan>)}</text></g>; })}
  </svg></div><figcaption>{provenance === "canonical" ? "Canonical Mermaid architecture" : "Generated from bundled Play metadata"} · rendered locally inside VS Code</figcaption></figure>;
}

export function parseFlowchart(chart: string): DiagramModel {
  const groups: DiagramModel["groups"] = [{ id: "root", label: "Architecture flow" }];
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  let group = "root";
  for (const rawLine of chart.replace(/\r/g, "").split("\n").slice(0, 500)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%%") || /^(graph|flowchart)\s+(TB|TD|BT|RL|LR)$/i.test(line) || /^(style|classDef|class|linkStyle)\s+/i.test(line)) continue;
    const bracketedSubgraph = line.match(/^subgraph\s+([\w-]+)\s*\[([^\]]+)\]$/i);
    const plainSubgraph = line.match(/^subgraph\s+(.+)$/i);
    if (bracketedSubgraph || plainSubgraph) {
      const title = cleanLabel(bracketedSubgraph?.[2] || plainSubgraph?.[1] || "Architecture layer");
      group = bracketedSubgraph?.[1] || `group-${groups.length}`;
      groups.push({ id: group, label: title });
      continue;
    }
    if (/^end$/i.test(line)) { group = "root"; continue; }
    const edge = line.match(/^(.+?)\s*(?:-->|---|-.->|==>)\s*(?:\|([^|]+)\|\s*)?(.+)$/);
    if (edge) {
      const from = parseNode(edge[1], group); const to = parseNode(edge[3], group);
      if (from && to) { if (!nodes.has(from.id)) nodes.set(from.id, from); if (!nodes.has(to.id)) nodes.set(to.id, to); edges.push({ from: from.id, to: to.id, label: cleanLabel(edge[2] || "") }); }
      continue;
    }
    const node = parseNode(line, group);
    if (node && node.label !== node.id) nodes.set(node.id, node);
  }
  if (!nodes.size) parseNonFlowchart(chart, nodes, edges);
  const usedGroups = new Set([...nodes.values()].map((node) => node.group));
  return { groups: groups.filter((entry, index) => index === 0 || usedGroups.has(entry.id)), nodes: [...nodes.values()].slice(0, 80), edges: edges.slice(0, 160) };
}

function parseNonFlowchart(chart: string, nodes: Map<string, DiagramNode>, edges: DiagramEdge[]): void {
  const lines = chart.replace(/\r/g, "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^(sequenceDiagram|timeline|journey|mindmap|stateDiagram(?:-v2)?|classDiagram|erDiagram|gitGraph|pie|quadrantChart|xychart-beta|title\b)/i.test(line)) continue;
    const sequence = line.match(/^([A-Za-z][\w-]*)\s*(?:--?>>?|--?>|-.->>)\s*([A-Za-z][\w-]*)\s*:\s*(.+)$/);
    if (sequence) {
      const from = sequence[1]; const to = sequence[2];
      if (!nodes.has(from)) nodes.set(from, { id: from, label: cleanLabel(from), group: "root" });
      if (!nodes.has(to)) nodes.set(to, { id: to, label: cleanLabel(to), group: "root" });
      edges.push({ from, to, label: cleanLabel(sequence[3]) }); continue;
    }
    const state = line.match(/^([A-Za-z][\w-]*)\s*-->\s*([A-Za-z][\w-]*)(?:\s*:\s*(.+))?$/);
    if (state) {
      if (!nodes.has(state[1])) nodes.set(state[1], { id: state[1], label: cleanLabel(state[1]), group: "root" });
      if (!nodes.has(state[2])) nodes.set(state[2], { id: state[2], label: cleanLabel(state[2]), group: "root" });
      edges.push({ from: state[1], to: state[2], label: cleanLabel(state[3] || "") }); continue;
    }
    const participant = line.match(/^(?:participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?$/i);
    if (participant) { nodes.set(participant[1], { id: participant[1], label: cleanLabel(participant[2] || participant[1]), group: "root" }); continue; }
    const timeline = line.match(/^([^:]{1,50})\s*:\s*(.+)$/);
    if (timeline && !/^(section|accTitle|accDescr)$/i.test(timeline[1].trim())) {
      const id = `event-${nodes.size + 1}`; nodes.set(id, { id, label: `${cleanLabel(timeline[1])}\n${cleanLabel(timeline[2])}`, group: "root" });
      const previous = [...nodes.keys()].at(-2); if (previous) edges.push({ from: previous, to: id, label: "" }); continue;
    }
  }
  if (nodes.size) return;
  const semantic = lines.map((line) => cleanLabel(line.trim())).filter((line) => line && !/^(section|accTitle|accDescr|dateFormat|axisFormat)\b/i.test(line)).slice(0, 16);
  semantic.forEach((label, index) => { const id = `step-${index + 1}`; nodes.set(id, { id, label, group: "root" }); if (index) edges.push({ from: `step-${index}`, to: id, label: "" }); });
}

function parseNode(expression: string, group: string): DiagramNode | null {
  const value = expression.trim().replace(/;$/, "");
  const match = value.match(/^([A-Za-z][\w-]*)(?:\s*(?:\["?([\s\S]*?)"?\]|\(\(?"?([\s\S]*?)"?\)\)?|\{"?([\s\S]*?)"?\}))?$/);
  if (!match) return null;
  return { id: match[1], label: cleanLabel(match[2] || match[3] || match[4] || match[1]), group };
}

function cleanLabel(value: string): string { return value.replace(/^['"]|['"]$/g, "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim().slice(0, 180); }
function labelLines(value: string): string[] { const parts = value.split(/\n|\s+·\s+/).map((part) => part.trim()).filter(Boolean); return (parts.length ? parts : [value]).slice(0, 3); }
