"use client";

import { useEffect, useState } from "react";
import { api, type GraphData, type SolveParams } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type Controls = {
  mode: "paper" | "random" | "custom";
  text: string;
  paperText: string;
  randomN: number;
  p: number;
  shots: number;
  maxIter: number;
  restarts: number;
  seed: number;
};

export function useControls() {
  const [c, setC] = useState<Controls>({ mode: "paper", text: "", paperText: "", randomN: 12, p: 2, shots: 2048, maxIter: 300, restarts: 3, seed: 42 });
  const [paperGraph, setPaperGraph] = useState<GraphData | null>(null);
  useEffect(() => {
    api.sample().then((s) => {
      setC((x) => ({ ...x, paperText: s.text, text: s.text }));
      setPaperGraph(s.graph);
    }).catch(() => {});
  }, []);
  return { c, set: (patch: Partial<Controls>) => setC((x) => ({ ...x, ...patch })), paperGraph };
}

export function toParams(c: Controls, extra: Partial<SolveParams> = {}): SolveParams {
  return {
    network_text: c.mode === "random" ? null : c.mode === "paper" ? c.paperText : c.text,
    random_nodes: c.mode === "random" ? c.randomN : null,
    p: c.p, shots: c.shots, max_iter: c.maxIter, restarts: c.restarts, seed: c.seed, ...extra,
  };
}

const MODES = [
  { id: "paper", label: "Paper network" },
  { id: "random", label: "Random" },
  { id: "custom", label: "Custom" },
] as const;

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-[13px] font-medium text-[var(--ink-2)]">{label}</Label>
        {value && <span className="num text-[13px] text-[var(--ink)]">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function ControlsPanel({ c, set, disabled, showDepth = true }: { c: Controls; set: (p: Partial<Controls>) => void; disabled?: boolean; showDepth?: boolean }) {
  const one = (v: number | readonly number[]) => (Array.isArray(v) ? (v as number[])[0] : (v as number));
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <p className="text-[13px] font-medium text-[var(--ink-2)]">Network</p>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-md bg-[var(--secondary)] p-1">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={c.mode === m.id} onClick={() => set({ mode: m.id })}
              className={`rounded px-2 py-1.5 text-[13px] transition-colors ${c.mode === m.id ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}>
              {m.label}
            </button>
          ))}
        </div>
        {c.mode === "paper" && <p className="text-[12.5px] leading-snug text-[var(--muted-foreground)]">16 users, 26 weighted connections. The best possible cut is 44.</p>}
        {c.mode === "random" && (
          <Row label="Users" value={String(c.randomN)}>
            <Slider min={6} max={18} step={1} value={[c.randomN]} onValueChange={(v) => set({ randomN: one(v) })} />
          </Row>
        )}
        {c.mode === "custom" && (
          <div className="space-y-1.5">
            <Textarea value={c.text} onChange={(e) => set({ text: e.target.value })} rows={9} spellCheck={false} className="num text-[12px] leading-relaxed" aria-label="Network definition" />
            <p className="text-[12px] text-[var(--muted-foreground)]">[NODES] one name per line, [EDGES] as "A B weight". 3 to 20 users.</p>
          </div>
        )}
      </div>

      {showDepth && (
        <Row label="Circuit depth p" value={String(c.p)}>
          <Slider min={1} max={4} step={1} value={[c.p]} onValueChange={(v) => set({ p: one(v) })} disabled={disabled} />
        </Row>
      )}
      <Row label="Shots per measurement" value={String(c.shots)}>
        <Slider min={512} max={8192} step={512} value={[c.shots]} onValueChange={(v) => set({ shots: one(v) })} disabled={disabled} />
      </Row>
      <Row label="Optimiser iterations" value={String(c.maxIter)}>
        <Slider min={50} max={600} step={50} value={[c.maxIter]} onValueChange={(v) => set({ maxIter: one(v) })} disabled={disabled} />
      </Row>
      <Row label="Random restarts" value={String(c.restarts)}>
        <Slider min={1} max={8} step={1} value={[c.restarts]} onValueChange={(v) => set({ restarts: one(v) })} disabled={disabled} />
      </Row>
    </div>
  );
}
