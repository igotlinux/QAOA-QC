"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { api, type GraphData, type SolveResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraphView } from "@/components/graph-view";
import { BaselineChart, ConvergenceChart, ProbabilityChart } from "@/components/charts";
import { ControlsPanel, toParams, useControls } from "@/components/controls";
import { CircuitSchematic } from "@/components/circuit-schematic";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <dt className="text-[13.5px] text-[var(--ink-2)]">
        {label}
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-[var(--muted-foreground)]">{hint}</span>}
      </dt>
      <dd className="num shrink-0 text-[16px] font-medium text-[var(--ink)]">{value}</dd>
    </div>
  );
}

export function SolveView() {
  const { c, set, paperGraph } = useControls();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<SolveResult | null>(null);
  const [split, setSplit] = useState(true);
  const [img, setImg] = useState(false);

  const plain: GraphData | null = res ? res.graph : c.mode === "paper" ? paperGraph : null;

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.solve(toParams(c, { with_circuit_image: img }));
      setRes(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const m = res?.qaoa.metrics;
  const enrich = res && m ? m.p_optimal / (res.optimum.optimal_states / 2 ** res.graph.nodes.length) : 0;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="font-serif text-[32px] leading-tight text-[var(--ink)]">Split a social network into two communities</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">
          Max-Cut puts users into two groups so that as much interaction weight as possible crosses between them. QAOA searches for that split with a small quantum circuit whose
          angles are tuned by a classical optimiser.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <section className="space-y-6 self-start rounded-lg border border-[var(--line)] bg-white p-5" aria-label="Run settings">
          <ControlsPanel c={c} set={set} disabled={busy} />
          <label className="flex items-center justify-between gap-3 text-[13px] text-[var(--ink-2)]">
            Also draw the Qiskit circuit
            <Switch checked={img} onCheckedChange={setImg} />
          </label>
          <Button onClick={run} disabled={busy} className="w-full bg-[var(--primary)] py-5 text-[14.5px] hover:bg-[#15216e]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {busy ? "Training the circuit" : "Run QAOA"}
          </Button>
          {err && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[13px] text-rose-900">{err}</p>}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border border-[var(--line)] bg-white p-5" aria-label="Network and partition">
            <div className="mb-1 flex items-center justify-between gap-4">
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">{res ? "Partition found by QAOA" : "Network"}</h2>
              {res && (
                <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                  Pull groups apart
                  <Switch checked={split} onCheckedChange={setSplit} />
                </label>
              )}
            </div>
            {plain ? (
              <GraphView graph={plain} solved={!!res} split={split} />
            ) : (
              <p className="py-20 text-center text-[14px] text-[var(--muted-foreground)]">Choose a network and press Run QAOA.</p>
            )}
            {res && (
              <div className="mt-3 grid gap-4 border-t border-[var(--line)] pt-4 text-[13.5px] sm:grid-cols-2">
                <p><span className="mr-2 inline-block size-2.5 rounded-full bg-[var(--group-a)]" />
                  <b>Group A</b> ({res.qaoa.groups.A.length}): {res.qaoa.groups.A.join(", ")}</p>
                <p><span className="mr-2 inline-block size-2.5 rounded-full bg-[var(--group-b)]" />
                  <b>Group B</b> ({res.qaoa.groups.B.length}): {res.qaoa.groups.B.join(", ")}</p>
                <p className="text-[12.5px] text-[var(--muted-foreground)] sm:col-span-2">
                  <span className="mr-2 inline-block h-1 w-5 rounded bg-[var(--cut)] align-middle" />
                  Rose edges are the cut: connections that cross between the groups.
                </p>
              </div>
            )}
          </section>

          {res && m && (
            <>
              <section className="grid gap-6 lg:grid-cols-2" aria-label="Result summary">
                <dl className="rounded-lg border border-[var(--line)] bg-white px-5 py-2">
                  <Metric label="Cut found (best of shots)" value={`${m.best_sampled_cut} / ${res.optimum.cut}`} hint="Weight of edges crossing the groups, against the exact optimum from brute force." />
                  <Metric label="Average cut of the circuit" value={`${(m.expected_ratio * 100).toFixed(1)}%`} hint={`Expected cut ${m.expected_cut.toFixed(1)} of ${res.optimum.cut}. A random split gets ${(m.random_mean / res.optimum.cut * 100).toFixed(0)}%.`} />
                  <Metric label="Chance one shot is optimal" value={`${(m.p_optimal * 100).toFixed(2)}%`} hint={`${enrich.toFixed(0)} times more likely than guessing.`} />
                </dl>
                <dl className="rounded-lg border border-[var(--line)] bg-white px-5 py-2">
                  <Metric label="Qubits and layers" value={`${res.circuit.qubits} and p=${res.qaoa.p}`} />
                  <Metric label="Optimiser evaluations" value={String(res.qaoa.evals)} hint={`${res.qaoa.seconds.toFixed(1)} s on this machine`} />
                  <Metric label="Best angles found" value={`${res.qaoa.gammas.length * 2} values`} hint={`gamma ${res.qaoa.gammas.map((x) => x.toFixed(2)).join(", ")}; beta ${res.qaoa.betas.map((x) => x.toFixed(2)).join(", ")}`} />
                </dl>
              </section>

              <section className="rounded-lg border border-[var(--line)] bg-white p-5" aria-label="Details">
                <Tabs defaultValue="conv">
                  <TabsList>
                    <TabsTrigger value="conv">Convergence</TabsTrigger>
                    <TabsTrigger value="prob">Measurements</TabsTrigger>
                    <TabsTrigger value="cmp">Versus classical</TabsTrigger>
                    <TabsTrigger value="circ">Circuit</TabsTrigger>
                  </TabsList>
                  <TabsContent value="conv" className="pt-4">
                    <p className="mb-3 max-w-2xl text-[13.5px] text-[var(--ink-2)]">Each point is the average cut measured with the current angles. COBYLA moves the angles to push it up, towards the optimum.</p>
                    <ConvergenceChart history={res.qaoa.history} optimum={res.optimum.cut} random={m.random_mean} />
                  </TabsContent>
                  <TabsContent value="prob" className="pt-4">
                    <p className="mb-3 max-w-2xl text-[13.5px] text-[var(--ink-2)]">The ten most frequent outcomes. Each bit is one user (0 = group A, 1 = group B). Green bars are optimal cuts. A split and its mirror image have the same cut, so they come in pairs.</p>
                    <ProbabilityChart top={res.qaoa.top} optimum={res.optimum.cut} />
                  </TabsContent>
                  <TabsContent value="cmp" className="pt-4">
                    <p className="mb-3 max-w-2xl text-[13.5px] text-[var(--ink-2)]">Same graph, same optimum. On a graph this small a classical method can match QAOA; see the scale tab for where the architecture matters. Louvain maximises modularity, not cut, so it scores low by design.</p>
                    <BaselineChart baselines={res.baselines} qaoa={m} optimum={res.optimum.cut} />
                  </TabsContent>
                  <TabsContent value="circ" className="pt-4 space-y-4">
                    <CircuitSchematic n={res.circuit.qubits} p={res.qaoa.p} edges={res.circuit.rzz_per_layer} />
                    {res.circuit_png && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`data:image/png;base64,${res.circuit_png}`} alt="Qiskit circuit diagram" className="max-w-full rounded border border-[var(--line)]" />
                    )}
                  </TabsContent>
                </Tabs>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
