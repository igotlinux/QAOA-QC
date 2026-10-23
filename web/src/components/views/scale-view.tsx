"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { api, type ScaleResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { SweepChart } from "@/components/charts";

export function ScaleView() {
  const [nodes, setNodes] = useState(300);
  const [sweeps, setSweeps] = useState(3);
  const [block, setBlock] = useState(12);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ScaleResult | null>(null);
  const one = (v: number | readonly number[]) => (Array.isArray(v) ? (v as number[])[0] : (v as number));

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.scale({ nodes, block_size: block, p: 2, sweeps, seed: 1 }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const bars = res
    ? [
        { name: "Random split", v: res.random },
        { name: "Spectral", v: res.spectral.cut },
        { name: "Greedy 1-flip", v: res.greedy.cut },
        { name: `Block-QAOA (${res.block_qaoa.qubits_per_block} qubits)`, v: res.block_qaoa.cut, q: true },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="font-serif text-[32px] leading-tight text-[var(--ink)]">What about networks with thousands of users?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">
          One quantum circuit cannot hold a whole social network, on any machine. So the network is cut into small blocks. QAOA re-optimises one block of about a dozen users while everyone
          else stays fixed, then moves to the next block. Each block needs only {block} qubits, whatever the network size, and blocks can run in parallel.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <section className="space-y-6 self-start rounded-lg border border-[var(--line)] bg-white p-5">
          <div className="space-y-2">
            <div className="flex justify-between"><Label className="text-[13px] font-medium text-[var(--ink-2)]">Users</Label><span className="num text-[13px]">{nodes.toLocaleString()}</span></div>
            <Slider min={100} max={3000} step={100} value={[nodes]} onValueChange={(v) => setNodes(one(v))} disabled={busy} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><Label className="text-[13px] font-medium text-[var(--ink-2)]">Qubits per block</Label><span className="num text-[13px]">{block}</span></div>
            <Slider min={6} max={14} step={2} value={[block]} onValueChange={(v) => setBlock(one(v))} disabled={busy} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><Label className="text-[13px] font-medium text-[var(--ink-2)]">Sweeps over the graph</Label><span className="num text-[13px]">{sweeps}</span></div>
            <Slider min={1} max={5} step={1} value={[sweeps]} onValueChange={(v) => setSweeps(one(v))} disabled={busy} />
          </div>
          <Button onClick={run} disabled={busy} className="w-full bg-[var(--primary)] py-5 text-[14.5px] hover:bg-[#15216e]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {busy ? "Solving blocks" : "Run block-QAOA"}
          </Button>
          <p className="text-[12.5px] leading-snug text-[var(--muted-foreground)]">A 3,000-user run takes about a minute. The graph is a synthetic hub-heavy network with weights 1 to 3.</p>
          {err && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[13px] text-rose-900">{err}</p>}
        </section>

        <div className="min-w-0 space-y-6">
          {res ? (
            <>
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border border-[var(--line)] bg-white p-5">
                  <h2 className="mb-3 text-[16px] font-semibold">Cut as a share of total weight</h2>
                  <ul className="space-y-3">
                    {bars.map((b) => (
                      <li key={b.name}>
                        <div className="mb-1 flex justify-between text-[13.5px]"><span>{b.name}</span><span className="num">{((b.v / res.total_weight) * 100).toFixed(1)}%</span></div>
                        <div className="h-2.5 rounded bg-[var(--secondary)]"><div className="h-full rounded" style={{ width: `${(b.v / res.total_weight) * 100}%`, background: b.q ? "var(--group-a)" : "var(--line-strong)" }} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-white p-5">
                  <h2 className="mb-1 text-[16px] font-semibold">Each sweep improves the cut</h2>
                  <SweepChart trace={res.block_qaoa.trace} total={res.total_weight} />
                </div>
              </section>
              <dl className="grid gap-x-8 rounded-lg border border-[var(--line)] bg-white px-5 py-3 text-[14px] sm:grid-cols-3">
                <div className="py-2"><dt className="text-[var(--ink-2)]">Network</dt><dd className="num text-[16px]">{res.nodes.toLocaleString()} users, {res.edges.toLocaleString()} links</dd></div>
                <div className="py-2"><dt className="text-[var(--ink-2)]">Blocks solved by QAOA</dt><dd className="num text-[16px]">{res.block_qaoa.blocks.toLocaleString()}</dd></div>
                <div className="py-2"><dt className="text-[var(--ink-2)]">Time</dt><dd className="num text-[16px]">{res.block_qaoa.seconds.toFixed(1)} s ({((res.block_qaoa.seconds / res.block_qaoa.blocks) * 1000).toFixed(0)} ms per block)</dd></div>
              </dl>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--line-strong)] bg-white py-24 text-center text-[14px] text-[var(--muted-foreground)]">Run the block solver to see it on a large network.</p>
          )}

          <section className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="mb-2 text-[16px] font-semibold">Why this is the answer to Instagram-scale questions</h2>
            <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
              <li>The 16-user case is the check against the exact answer. It proves the quantum routine is correct before we trust it on blocks.</li>
              <li>Work grows linearly with users: about N / 9 blocks, each costing the same. One sweep over 1 million users is roughly 110,000 blocks of at most 12 qubits.</li>
              <li>Blocks in different regions are independent enough to run on many devices at once.</li>
              <li>We claim an architecture and honest benchmarks, not a quantum speed-up. Million-user figures in the notebook are extrapolations of simulated block time.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
