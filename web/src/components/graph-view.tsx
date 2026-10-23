"use client";

import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY, forceCollide, type SimulationNodeDatum } from "d3-force";
import type { GraphData } from "@/lib/api";

type SimNode = SimulationNodeDatum & { id: number; name: string; group: number };

const W = 720;
const H = 540;

export function GraphView({ graph, solved, split }: { graph: GraphData; solved: boolean; split: boolean }) {
  const [, force] = useState(0);
  const nodesRef = useRef<SimNode[]>([]);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // rebuild the layout only when the graph structure changes
  const key = graph.nodes.map((n) => n.id).join(",") + "|" + graph.edges.map((e) => `${e.source}-${e.target}`).join(",");
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n, x: prev.get(n.id)?.x ?? W / 2 + Math.random() * 40, y: prev.get(n.id)?.y ?? H / 2 + Math.random() * 40 }));
    nodesRef.current = nodes;
    const links = graph.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));
    const sim = forceSimulation<SimNode>(nodes)
      .force("link", forceLink<SimNode, (typeof links)[number]>(links).id((d) => d.id).distance(86).strength(0.5))
      .force("charge", forceManyBody().strength(-340))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide(34))
      .on("tick", () => force((t) => t + 1));
    simRef.current = sim;
    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // push groups to opposite sides after a solve: the signature move
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const byId = new Map(graph.nodes.map((n) => [n.id, n.group]));
    nodesRef.current.forEach((n) => (n.group = byId.get(n.id) ?? 0));
    if (split && solved) {
      const yTargets = new Map<number, number>();
      for (const group of [0, 1]) {
        const members = nodesRef.current.filter((n) => n.group === group).sort((a, b) => a.id - b.id);
        const firstY = 76;
        const lastY = H - 76;
        members.forEach((node, index) => {
          yTargets.set(node.id, members.length > 1 ? firstY + index * (lastY - firstY) / (members.length - 1) : H / 2);
        });
      }
      const link = sim.force("link") as any;
      link?.strength((l: any) => (byId.get(l.source.id ?? l.source) === byId.get(l.target.id ?? l.target) ? 0.5 : 0.02));
      sim
        .force("x", forceX<SimNode>((d) => (d.group === 0 ? W * 0.22 : W * 0.78)).strength(0.4))
        .force("y", forceY<SimNode>((d) => yTargets.get(d.id) ?? H / 2).strength(0.65))
        .force("charge", forceManyBody().strength(-420));
    } else {
      (sim.force("link") as any)?.strength(0.5);
      sim.force("x", null).force("y", null).force("charge", forceManyBody().strength(-340));
    }
    sim.alpha(0.9).restart();
  }, [split, solved, graph]);

  const nodes = nodesRef.current;
  const xs = nodes.map((n) => n.x ?? W / 2);
  const ys = nodes.map((n) => n.y ?? H / 2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = 52;
  const padTop = 54;
  const padBottom = 58;
  const scale = Math.min(
    (W - padX * 2) / Math.max(maxX - minX, 1),
    (H - padTop - padBottom) / Math.max(maxY - minY, 1),
  );
  const offsetX = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = padTop + (H - padTop - padBottom - (maxY - minY) * scale) / 2 - minY * scale;
  const pos = new Map(nodes.map((n) => [n.id, {
    x: (n.x ?? W / 2) * scale + offsetX,
    y: (n.y ?? H / 2) * scale + offsetY,
  }]));
  const groupCenter = (group: number) => {
    const members = nodes.filter((n) => n.group === group).map((n) => pos.get(n.id)).filter((p) => p !== undefined);
    return members.length ? members.reduce((sum, p) => sum + p.x, 0) / members.length : W / 2;
  };
  const gcol = (g: number) => (!solved ? "var(--ink-3)" : g === 0 ? "var(--group-a)" : "var(--group-b)");
  const active = hover;

  return (
    <div className="overflow-x-auto">
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-160 select-none" role="img" aria-label="Social network partitioned into two communities">
      {split && solved && (
        <>
          <text x={groupCenter(0)} y={24} textAnchor="middle" className="fill-(--group-a) text-[13px] font-medium">Group A</text>
          <text x={groupCenter(1)} y={24} textAnchor="middle" className="fill-(--group-b-text) text-[13px] font-medium">Group B</text>
        </>
      )}
      {graph.edges.map((e, i) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return null;
        const cut = solved && e.cut;
        const hi = active !== null && (e.source === active || e.target === active);
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={cut ? "var(--cut)" : "var(--line-strong)"}
            strokeWidth={(cut ? 1.4 : 0.8) + e.weight * 0.7}
            strokeDasharray={cut ? "0" : "0"}
            opacity={active !== null && !hi ? 0.18 : cut ? 0.95 : 0.7}
            strokeLinecap="round"
            style={{ transition: "stroke 500ms, opacity 200ms" }}
          />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} transform={`translate(${pos.get(n.id)?.x ?? W / 2},${pos.get(n.id)?.y ?? H / 2})`} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} tabIndex={0} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}>
          <circle r={17} fill={gcol(n.group)} stroke="var(--surface)" strokeWidth={2.5} style={{ transition: "fill 500ms" }} />
          <text y={32} textAnchor="middle" className="fill-(--ink) text-[11px]">{n.name}</text>
        </g>
      ))}
    </svg>
    </div>
  );
}
